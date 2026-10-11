# پیشرو · Pishro

A Persian, RTL Scrum workspace built as one Nuxt full-stack application. The product loop is Backlog → Planning Poker → Estimate Review → Sprint → Daily → Done.

The supplied product specification is preserved in [docs/product-spec.md](docs/product-spec.md). This implementation targets its P0 MVP. Reference tasks, projections, automatic GitHub synchronization, PR automations, custom workflows, and advanced analytics remain outside the MVP.

## Implemented flows

| Area | Behavior |
| --- | --- |
| Identity | Register, password login, profile name, expiring server sessions, logout |
| Projects | Create, switch, settings, Admin/Member permissions, email-based addition and shareable invite links |
| Backlog | Enter-to-create, inline title/point/assignee/sprint editing, selection, atomic bulk updates, reorder and keyboard alternatives |
| Tasks | Side drawer, description, status, priority, points, assignee, sprint and attached PRs |
| Sprint | Planned/active/completed lifecycle, one active sprint per project, fixed four-column Kanban and mobile status controls |
| Progress | Done-only points, expected working-day progress, delta, remaining points, added scope, lightweight SVG step chart |
| Daily | Working-day matrix, own report creation/editing, yesterday/today/blockers, related tasks, historical reports including former members |
| Poker | Draft, lobby, voting, reveal, revote, accept-and-next, estimate review and finalization |
| Calibration | Point buckets, drag or select to move, median/average/range/extremes, disagreement flag, previous rounds and estimate history |
| GitHub | Paste a PR URL to fetch and store number, repository, title, state and URL; no automatic Task transitions |

The interface uses the supplied Pishro icon, a locally hosted variable **Estedad / استعداد** font, flat surfaces, UnoCSS utilities, CSS-mode Nuxt Icon, native dialogs, short transitions, keyboard controls and reduced-motion support. Font files and their [OFL license](public/fonts/OFL.txt) are included in `public/fonts`. The font comes from its [official repository](https://github.com/aminabedi68/Estedad).

## Setup

Use Bun and a Node version satisfying `package.json`: `^22.22.3 || ^24.15.0 || >=26.0.0`. MySQL must support InnoDB, JSON columns and indexed generated columns (MySQL 8+).

1. Run `bun install`.
2. Copy `.env.example` to `.env` and set `NUXT_DATABASE_URL`. URL-encode special characters in credentials.
3. Create a UTF-8 database if needed:

   ```sql
   CREATE DATABASE pishro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

4. Apply the committed migrations with `bun run db:migrate`.
5. Start Nuxt with `bun run dev` and visit `http://localhost:3000`.
6. Register, create a project, invite teammates, and add real work to its backlog. The application does not seed fake projects or metrics.

Bun loads `.env` for migration scripts. The Nuxt dev server reads `.env`; the production process requires its runtime environment variables explicitly configured.

The second migration adds the Scrum model without deleting prototype data. Old tables are retained in `server/database/legacy.ts` for migration compatibility. The anonymous prototype pages and endpoints have been removed; Poker now requires a user account and project membership. Existing prototype rooms are not automatically converted into projects.

## Product rules

- A project's landing page is its Sprint page.
- Only Done tasks contribute points. Progress events record completion, reopening, point corrections and moving completed tasks between sprints at the time they occur.
- Expected progress uses the sprint's saved working-day calendar. Dates are stored as Gregorian date values, displayed in Persian, and daily boundaries use `Asia/Tehran`.
- Each sprint snapshots working days when created. Changing project defaults does not alter past sprint calendars.
- Ending a sprint preserves its tasks. Move unfinished work through the Backlog when planning the next sprint.
- Members can edit tasks, submit their own reports and create Poker sessions. Administrators manage membership, project settings and sprint lifecycle. A project always retains at least one administrator.
- Project invite links last seven days. Share links yourself; no email delivery service is introduced. Email-based addition works for users who have already registered.
- Removing a member clears their task assignments and revokes project access. Reports and votes remain. Open sessions they facilitated transfer to a remaining project administrator.
- Poker is limited to 100 tasks and 50 participants at creation. The creator facilitates the session; selected participants must be project members.
- Hidden votes never leave the server except a participant's own selected card. Previously revealed rounds remain in history after revotes.
- Accepting or calibrating an estimate updates the actual Task point and estimate history atomically. Completing voting enters Review; finalization is a separate action. Finalized sessions are read-only.
- Task drawers and Poker actions use revisions to reject stale updates. Bulk changes and round transitions use transactions and consistent lock ordering.

## GitHub

Public PR metadata works without credentials. Configure a project's repository in Settings to restrict attachment URLs to that repository.

For private repositories, set a server-only JSON map of project UUIDs to appropriately restricted tokens, for example:

```dotenv
NUXT_GITHUB_TOKENS={"your-project-uuid":"github_pat_..."}
```

Also set that project's repository in Settings. Use a fine-grained token restricted to the intended repository with pull-request read access. Credentials are never returned to the browser and a project's token is not used by other projects.

Metadata is fetched when a PR is attached (or reattached). There are no background synchronization jobs, webhooks or automatic status changes. The integration uses the [GitHub pull request REST endpoint](https://docs.github.com/en/rest/pulls/pulls).

## Authentication and deployment

Passwords use native asynchronous Node scrypt with a random salt and stored parameters (`N=32768`, `r=8`, `p=3`), corresponding to an [OWASP-listed configuration](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt). Passwords retain their original characters and whitespace. Session tokens are random, stored as hashes, and issued through HttpOnly, SameSite cookies lasting 30 days. Production cookies require HTTPS.

Login attempts are throttled in process (10 attempts per email/IP within 15 minutes). This throttle resets on process restart and is independent across instances; account and project authorization still run against MySQL on the server.

SSE streams read shared MySQL state approximately once per second. Presence updates every 10 seconds and becomes offline after 25 seconds without a heartbeat. EventSource reconnects automatically. Authentication is rechecked during heartbeats and project membership during snapshots. Connections release their timers, and the database pool closes on server shutdown.

Use a Node runtime that supports persistent streaming responses. Disable proxy buffering for Poker SSE endpoints. This intentionally simple mechanism needs no broker or separate backend; database work scales with connected streams.

For deployment, apply `bun run db:migrate`, build the application, and run `.output/server/index.mjs` with Node and the production environment. Migration application is an explicit deployment step; do not use schema pushing. `GET /api/health` reports process liveness and does not query MySQL.

## Commands and validation

| Command | Purpose |
| --- | --- |
| `bun run dev` | Development server |
| `bun run build` | Full-stack production build |
| `bun run preview` | Preview production build |
| `bun run typecheck` | Nuxt/Vue TypeScript checks |
| `bun run lint` | Oxlint correctness checks with TypeScript/Vue rules |
| `bun run format` | Canonical Oxfmt formatting |
| `bun run format:check` | Check formatting |
| `bun run db:generate --name=describe_change` | Generate versioned migration artifacts |
| `bun run db:migrate` | Apply committed SQL migrations |

TypeScript is constrained to `~6.0.3` because the current `vue-tsc` imports compiler APIs removed in TypeScript 7. Other direct dependencies use stable releases. Oxfmt uses single quotes and no semicolons. No ESLint, Prettier, UI framework, chart library or realtime platform is added.

Per repository instructions, build, lint, tests, type checking, formatting and other validation commands were **not run** during implementation. SQL migrations were generated but **not applied** to a database. The maintainer should format and independently verify the application; a CI sequence can run `typecheck`, `lint`, `format:check`, then `build`.

## Source layout

```text
app/
  components/       Dialogs, tasks, charts, Kanban, voting, calibration and feedback
  composables/      Auth state, project data, actions and SSE lifecycle
  layouts/          Account shell and project sidebar/top bar
  middleware/       Client navigation authentication
  pages/            Auth, projects, Sprint, Backlog, Daily, Poker and Settings
server/
  api/              Auth, project, task, sprint, daily, GitHub and Poker endpoints
  database/         Drizzle schema and retained prototype schema
  middleware/       API origin, content-type and cache policy
  services/         Project snapshots, task contributions and Poker state transitions
  utils/            Authentication, input parsing, database and JSON boundaries
shared/             Schema-derived DTOs, workflow values, statistics and calendar
drizzle/            SQL migrations and Drizzle generation metadata
docs/               Supplied product specification
public/fonts/       Estedad variable WOFF2 and OFL license
```
