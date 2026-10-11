# پیشرو · Pishro

A small, Persian-first team planning application. Planning Poker runs inside a single Nuxt application, with persistent MySQL storage and realtime updates over Server-Sent Events (SSE).

## Stack

- Nuxt 4, Vue 3, strict TypeScript, and file-based routing
- UnoCSS with `presetWind3` and `@unocss/reset/tailwind.css`
- Nuxt Icon in CSS mode with a locally installed Lucide collection
- MySQL, `mysql2`, stable Drizzle ORM, and versioned Drizzle Kit migrations
- Oxlint with TypeScript/Vue checks and Oxfmt with single quotes and no semicolons

Dependencies use stable releases. TypeScript is intentionally constrained to `~6.0.3`: the current `vue-tsc` release loads `typescript/lib/tsc`, which TypeScript 7 no longer exports. Upgrade this constraint when Vue's type checker supports the new compiler API. The lockfile records exact resolutions.

## Local setup

Use Bun and a Node version satisfying `package.json` (`^22.22.3 || ^24.15.0 || >=26.0.0`). MySQL must use InnoDB so foreign keys and transactions are enforced.

1. Install dependencies with `bun install`.
2. Copy `.env.example` to `.env` and configure `NUXT_DATABASE_URL` for your MySQL instance. URL-encode special characters in credentials.
3. Create the database with UTF-8 support, for example:

   ```sql
   CREATE DATABASE pishro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

4. Apply the committed migration with `bun run db:migrate`.
5. Start the application with `bun run dev`, then open `http://localhost:3000`.

Bun loads `.env` for the migration scripts. The Nuxt development server also reads `.env`. A production process needs `NUXT_DATABASE_URL` set in its environment.

## Planning Poker

Create a named session with your name and an initial list of tasks. Share its link with teammates, who join by choosing a name. Cards follow a Fibonacci-style deck with additional uncertainty and break cards.

- Votes remain private until the host reveals them. The server never sends another participant's hidden vote.
- Participants can change their card while voting is open.
- The host can reveal results, restart voting, advance to the next task, and add tasks during or after the session.
- Revealed results include a vote distribution, agreement indicator, and numeric average. Non-numeric cards are excluded from the average.
- Tasks, participants, and votes persist in MySQL. Restarting a vote clears that task's previous votes.
- Room-row locks serialize mutations. Revision checks reject requests from an earlier round, including delayed requests after a reset.

A session supports up to 50 participant identities and 100 tasks (up to 50 initial tasks). Anyone holding its unguessable invite link can join; this is a lightweight internal tool without account authentication. The host's authority is stored in a room-specific, HttpOnly cookie in the browser used to create the session. Preserve that cookie to retain host access. Cookies last 30 days and require HTTPS in production.

## Realtime and deployment

SSE streams check shared MySQL state approximately once per second and send changed snapshots. Presence heartbeats run every 10 seconds; participants become offline after 25 seconds without a heartbeat. EventSource reconnects automatically and receives a full authoritative snapshot. Timers are released when connections close, and the database pool closes during server shutdown.

This approach needs no separate realtime service and works across Nuxt server processes sharing one database. It suits small internal teams; database work scales with connected streams. Use a Node server runtime with persistent streaming responses, and disable proxy buffering for the SSE endpoint. Avoid static-only deployment and platforms that cannot sustain SSE connections.

Build with `bun run build`, then run `.output/server/index.mjs` using Node with the production environment configured. Apply `bun run db:migrate` as an explicit deployment step before starting the updated application. Never use schema pushing as the production migration strategy.

`GET /api/health` reports application liveness; it does not check database connectivity.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start Nuxt development server |
| `bun run build` | Build the full-stack application |
| `bun run preview` | Preview the production build |
| `bun run typecheck` | Check application, server, and shared TypeScript |
| `bun run lint` | Run Oxlint correctness checks |
| `bun run format` | Format with Oxfmt |
| `bun run format:check` | Check canonical formatting |
| `bun run db:generate --name=describe_change` | Generate a migration after schema changes |
| `bun run db:migrate` | Apply committed migrations |

A CI verification sequence is `typecheck`, `lint`, `format:check`, then `build`. These commands are provided for the maintainer to run; they were not executed during implementation.

Commit generated SQL and `drizzle/meta` files together with schema changes. Migration generation does not apply changes to the database.

## Layout

```text
app/
  assets/css/       Small global accessibility and typography rules
  components/       Participants, task queue, and revealed results
  composables/      Typed room actions and SSE lifecycle
  layouts/          Shared Persian/RTL shell
  pages/            Home and room routes
  utils/            User-facing request errors
server/
  api/              Session, voting, round, task, SSE, and health endpoints
  database/         TypeScript Drizzle schema
  middleware/       API origin, content type, and cache policy
  plugins/          Database shutdown lifecycle
  services/         Consistent, privacy-filtered room snapshots
  utils/            Database access, identity, and request parsing
shared/             Public room types and card values
drizzle/            Versioned SQL migrations and generation metadata
```

Application icons use Nuxt Icon exclusively. The supplied project artwork lives at `public/pishro-icon.png` and is also used as the favicon. Interface styling uses flat colors, borders, utility classes, and short transitions with reduced-motion support.
