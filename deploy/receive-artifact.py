#!/usr/bin/env python3
"""Receive trusted CI artifacts for a fixed project through a forced SSH key."""

import ctypes
from datetime import datetime, timezone
import fcntl
import hashlib
import http.client
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import time

ROOT = Path('/home/mojtaba/projects')
PROJECTS = {
    'maash': {'static': True, 'process': 'maash', 'port': 3004},
    'hk_saher': {'static': False, 'process': 'hoosh-kavan-saher', 'port': 3002},
    'pishro': {'static': False, 'process': 'pishro', 'port': 3003},
}
MAX_UPLOAD = 256 * 1024 * 1024
MAX_EXPANDED = 512 * 1024 * 1024
MIN_FREE = 64 * 1024 * 1024
MAX_ENTRIES = 100000


class LimitedInput(io.RawIOBase):
    def __init__(self, source):
        self.source = source
        self.received = 0

    def read(self, size=-1):
        data = self.source.read(min(65536 if size < 0 else size, MAX_UPLOAD - self.received + 1))
        self.received += len(data)
        if self.received > MAX_UPLOAD:
            raise ValueError('Compressed artifact exceeds 256 MiB')
        return data


def unpack(destination):
    expanded = 0
    entries = 0
    upload = LimitedInput(sys.stdin.buffer)
    with tarfile.open(fileobj=upload, mode='r|gz') as archive:
        for member in archive:
            entries += 1
            if entries > MAX_ENTRIES:
                raise ValueError('Too many archive entries')
            name = PurePosixPath(member.name)
            if name.is_absolute() or '..' in name.parts or '\\' in member.name:
                raise ValueError('Unsafe archive path')
            if not member.isdir() and not member.isfile():
                raise ValueError('Archive links and special files are forbidden')
            if member.issparse():
                raise ValueError('Sparse archive members are forbidden')
            if str(name) == '.':
                if not member.isdir():
                    raise ValueError('Invalid archive root')
                continue
            target = destination.joinpath(*name.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True, mode=0o755)
                continue
            expanded += member.size
            if member.size < 0 or expanded > MAX_EXPANDED:
                raise ValueError('Expanded artifact exceeds 512 MiB')
            if shutil.disk_usage(destination).free < member.size + MIN_FREE:
                raise ValueError('Artifact would exhaust free disk space')
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
            with archive.extractfile(member) as source, target.open('xb') as output:
                shutil.copyfileobj(source, output, length=65536)
                if output.tell() != member.size:
                    raise ValueError('Incomplete archive member')
            target.chmod(0o755 if member.mode & 0o111 else 0o644)
    while upload.read(65536):
        pass
    destination.chmod(0o755)


def exchange(first, second):
    libc = ctypes.CDLL(None, use_errno=True)
    renameat2 = libc.renameat2
    renameat2.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    renameat2.restype = ctypes.c_int
    if renameat2(-100, os.fsencode(first), -100, os.fsencode(second), 2) != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))


def process_environment(name):
    result = subprocess.run(['pm2', 'jlist'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=20)
    matches = [app for app in json.loads(result.stdout) if app.get('name') == name]
    if len(matches) != 1:
        raise RuntimeError('Expected one configured PM2 process')
    result = os.environ.copy()
    for key, value in matches[0]['pm2_env'].items():
        if re.fullmatch(r'[A-Z][A-Z0-9_]*', key) and isinstance(value, str):
            result[key] = value
    result.pop('NODE_PATH', None)
    return result


def run(command, log, environment=None, timeout=180):
    result = subprocess.run(command, env=environment, stdout=log, stderr=log, timeout=timeout)
    if result.returncode:
        raise RuntimeError('Deployment command failed; inspect the private server log')


def healthy(name, config, expected_index=None):
    connection = http.client.HTTPConnection('127.0.0.1', config['port'], timeout=3)
    try:
        connection.request('GET', '/' if config['static'] else '/api/health')
        response = connection.getresponse()
        body = response.read()
        if response.status != 200:
            return False
        if config['static']:
            return hashlib.sha256(body).digest() == expected_index
        value = json.loads(body)
        if name == 'pishro':
            return value.get('status') == 'ok'
        return value.get('ok') is True or value.get('data', {}).get('ok') is True
    except (OSError, ValueError, http.client.HTTPException):
        return False
    finally:
        connection.close()


def wait_for_health(name, config, expected_index):
    for _ in range(30):
        if healthy(name, config, expected_index):
            return
        time.sleep(1)
    raise RuntimeError('New release failed its production health check')


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in PROJECTS:
        raise ValueError('A fixed deployment project is required')
    name = sys.argv[1]
    config = PROJECTS[name]
    command = re.fullmatch(r'deploy ([0-9a-f]{40})', os.environ.get('SSH_ORIGINAL_COMMAND', ''))
    if not command:
        raise ValueError('Only deploy <commit-sha> is permitted')
    project = ROOT / name
    if project.is_symlink() or project.resolve(strict=True) != project:
        raise ValueError('Unexpected project path')
    live = project / '.output'
    if config['static']:
        live = live / 'public'
    previous = live.with_name('.public-previous' if config['static'] else '.output.previous')
    for path in [live, previous]:
        if path.is_symlink() or (path.exists() and not path.is_dir()):
            raise ValueError('Unexpected release path')
    if live.parent.is_symlink() or live.parent.resolve(strict=True) != live.parent:
        raise ValueError('Unexpected release parent')

    with (project / '.artifact-deploy.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('Another deployment is in progress') from None
        stage = Path(tempfile.mkdtemp(prefix='.artifact-upload-', dir=live.parent))
        log_directory = Path('/home/mojtaba/projects/server-manager/deploy-logs')
        log_directory.mkdir(mode=0o700, exist_ok=True)
        log_path = log_directory / (name + '.log')
        if log_path.exists() and log_path.stat().st_size > 1024 * 1024:
            os.replace(log_path, log_path.with_suffix('.log.1'))
        log_descriptor = os.open(log_path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
        published = False
        had_live = live.exists()
        try:
            unpack(stage)
            metadata = json.loads((stage / 'deployment.json').read_text())
            if metadata.get('project') != name or metadata.get('commit') != command.group(1):
                raise ValueError('Artifact identity does not match the SSH command')
            required = ['index.html', 'sw.js'] if config['static'] else [
                'server/index.mjs', 'server/nitro-entry.mjs',
                'deploy/migrate.cjs', 'deploy/migrations/meta/_journal.json',
            ]
            if not all((stage / item).is_file() for item in required):
                raise ValueError('Artifact is missing production files')
            if not (stage / ('_nuxt' if config['static'] else 'public')).is_dir():
                raise ValueError('Artifact has no client assets')
            expected_index = hashlib.sha256((stage / 'index.html').read_bytes()).digest() if config['static'] else None

            with os.fdopen(log_descriptor, 'ab', buffering=0) as log:
                log_descriptor = None
                log.write(('\nDeploy ' + metadata['commit'] + '\n').encode())
                environment = process_environment(config['process'])
                if not config['static']:
                    run([
                        'node', '--env-file-if-exists=' + str(project / '.env'),
                        str(stage / 'deploy/migrate.cjs'), str(stage / 'deploy/migrations'),
                    ], log, environment)
                if had_live:
                    exchange(stage, live)
                else:
                    stage.rename(live)
                published = True
                try:
                    if not config['static']:
                        run(['pm2', 'restart', config['process']], log, timeout=45)
                    wait_for_health(name, config, expected_index)
                except BaseException:
                    if had_live:
                        exchange(stage, live)
                    else:
                        live.rename(stage)
                    published = False
                    if not config['static']:
                        run(['pm2', 'restart', config['process']], log, timeout=45)
                    raise

            state = {
                'project': name,
                'commit': metadata['commit'],
                'deployedAt': datetime.now(timezone.utc).isoformat(),
            }
            pending = project / '.deployment-state.json.tmp'
            pending.write_text(json.dumps(state) + '\n')
            os.replace(pending, project / '.deployment-state.json')
            if stage.exists():
                if previous.exists():
                    shutil.rmtree(previous)
                stage.rename(previous)
            print(json.dumps({'ok': True, **state}), flush=True)
        finally:
            if log_descriptor is not None:
                os.close(log_descriptor)
            if stage.exists():
                shutil.rmtree(stage)


def expire_upload(signum, frame):
    raise TimeoutError('Deployment exceeded its fifteen-minute limit')


if __name__ == '__main__':
    os.umask(0o022)
    signal.signal(signal.SIGALRM, expire_upload)
    signal.alarm(900)
    try:
        main()
    except Exception as error:
        print('Artifact deployment failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
