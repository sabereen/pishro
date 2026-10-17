import { cp, mkdir, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const commit = process.env.GITHUB_SHA
if (!commit || !/^[0-9a-f]{40}$/.test(commit)) {
  throw new Error('Packaging requires the GitHub commit SHA')
}
const output = resolve('.output')

await mkdir(resolve(output, 'deploy'), { recursive: true })
await cp(resolve('drizzle'), resolve(output, 'deploy/migrations'), { recursive: true })
// Keep the existing PM2 entrypoint while loading server-local configuration
// before Nitro evaluates its runtime defaults. Production secrets stay on-server.
await rename(resolve(output, 'server/index.mjs'), resolve(output, 'server/nitro-entry.mjs'))
const entry = [
  "import { existsSync } from 'node:fs'",
  "import { loadEnvFile } from 'node:process'",
  "const envFile = new URL('../../.env', import.meta.url)",
  "if (existsSync(envFile)) loadEnvFile(envFile)",
  ...["DATABASE_URL"].map((key) =>
    'if (!process.env.NUXT_' + key + ' && process.env.' + key + ') process.env.NUXT_' + key + ' = process.env.' + key,
  ),
  "await import('./nitro-entry.mjs')",
].join('\n') + '\n'
await writeFile(resolve(output, 'server/index.mjs'), entry)

await writeFile(resolve(output, 'deployment.json'), JSON.stringify({
  project: 'pishro',
  commit,
  builtAt: new Date().toISOString(),
}) + '\n')
