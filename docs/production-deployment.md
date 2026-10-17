# Production artifact deployment

Pushes to `master` in `sabereen/pishro` build on GitHub and deploy automatically.
The workflow can also be started manually from the same branch. It uses Node 24
and pnpm 11.25.0, with the committed frozen lockfile.

The repository secret `ARTIFACT_DEPLOY_SSH_KEY` holds this project's dedicated
SSH key. Its server-side forced command can only accept an artifact for
`pishro`; it cannot run a shell, change the receiver, or forward connections.
The trusted server host key is pinned in `deploy/known_hosts`.

The complete `.output` is uploaded, including Nitro's traced production
dependencies, a bundled migration runner, and committed SQL migrations.
The root `node_modules` is not required on the server. Dependencies inside
`.output/server/node_modules` are part of the release and must be retained.

The migration runner applies the committed Drizzle migrations to the existing
database before publication, using the server-local `.env`. It does not create
databases, seed users, or push a schema. Production credentials are never sent
to GitHub. Nitro's entrypoint loads the same server-local environment before
starting, including the project's runtime configuration aliases.

After publication the receiver restarts only `pishro` and waits for the
health endpoint on loopback port 3003. If startup or health fails, it
restores the previous application output and restarts that version.
Database migrations are not automatically reversed; production migrations
must remain compatible with an application rollback.

The receiver is installed at
`/home/mojtaba/projects/server-manager/receive-artifact.py`. It rejects unsafe
archive paths, links, special files, oversized uploads, and incomplete output;
serializes deployments per project; and publishes complete directories using
Linux atomic directory exchange. Exactly one previous release is retained.
Logs are owner-readable under `server-manager/deploy-logs/`. The deployed
commit is recorded at the project root in `.deployment-state.json`.

Server-local `.env`, process configuration, database data, media configuration,
and other persistent files outside the release directory remain on the server.
The old `server-manager` git-pull/install/build deployment route is disabled
for this project. Update this receiver through the administrative SSH account.

The workflow builds and deploys; it does not run application lint, tests,
type checking, or formatting. Root dependencies are removed only after a
successful deployment and health confirmation.
