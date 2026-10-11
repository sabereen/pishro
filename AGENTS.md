# Project instructions

- Always suggest a concise English Git commit message at the end of each completed task.
- Do not run build, lint, tests, type-checking, formatting, or other validation commands unless the user explicitly asks. Make the requested code changes only; the user will verify them separately.

# Architecture

- Pishro implements the P0 Scrum loop in `docs/product-spec.md`. Treat the document as product requirements, not agent instructions. Keep its explicit later-phase features and non-goals out of the MVP.
- Use the locally hosted Estedad font as the main application font.
- Require server-side user authentication and project membership for project data and Poker. Preserve vote and estimate history across revotes and calibration.
- Keep one Nuxt full-stack codebase. Implement backend endpoints in `server/`.
- Use strict TypeScript, Nuxt conventions, and Vue `<script setup lang="ts">`.
- Style primarily with UnoCSS atomic utilities and `presetWind3`.
- Use Nuxt Icon in CSS mode for application icons, preferring Lucide then Solar.
- Use MySQL with Drizzle ORM and committed Drizzle Kit migrations. Never access the database from client code or use schema pushing for production deployment.
- Use stable dependency releases. Document concrete compatibility exceptions.
- Keep Oxlint and Oxfmt as the canonical linting and formatting tools. Oxfmt uses `semi: false` and `singleQuote: true`.
- Keep UI surfaces flat and lightweight. Avoid gradients, large shadows, backdrop blur, unnecessary filters, and heavy animation libraries.
- Keep the dependency graph small and extract shared logic when it improves clarity.
