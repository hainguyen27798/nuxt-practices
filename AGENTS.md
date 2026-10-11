# Repository Guidelines

## Project Structure & Module Organization

Application code lives under `app/`; the current root component is `app/app.vue`. Add pages in
`app/pages/`, reusable components in `app/components/`, composables in `app/composables/`, and
shared utilities in `app/utils/`. Place files served unchanged in `public/`.

Top-level configuration includes `nuxt.config.ts`, `tsconfig.json`, `eslint.config.mjs`, and
`.prettierrc`. Do not edit or commit generated directories such as `.nuxt/`, `.output/`, and `dist/`.

## Build, Test, and Development Commands

Use Node `24.17.0` (see `.nvmrc`) and npm; `package-lock.json` is the authoritative lockfile.

- `npm install` installs dependencies and runs Nuxt preparation.
- `npm run dev` starts the local development server on port `3001`.
- `npm run build` creates a production build in `.output/`.
- `npm run preview` serves the production build locally.
- `npm run generate` produces a statically generated deployment.
- `npm run lint` runs ESLint followed by Nuxt TypeScript checking.
- `npm run lint:fix` applies safe ESLint and Prettier fixes.

## Coding Style & Naming Conventions

Write Vue Single-File Components with TypeScript when scripting is needed. Follow the configured
Prettier rules: two-space indentation, single quotes, semicolons, trailing commas, and a 100-character
line width. ESLint enforces sorted imports, removes unused imports, requires strict equality, and
rejects debugger statements. Prefix intentionally unused parameters with `_`.

Name Vue components in PascalCase (`UserCard.vue`), composables with a `use` prefix
(`useSession.ts`), and route files with lowercase Nuxt conventions (`users/[id].vue`).

## Testing Guidelines

No test framework or coverage threshold is configured. Every change must pass
`npm run lint` and `npm run build`. For UI changes, verify the affected route in `npm run dev` and
include screenshots in the pull request. When adding a test framework, colocate focused tests as
`*.spec.ts` near the code they exercise and add the command to `package.json`.

## Commit & Pull Request Guidelines

The existing history uses Conventional Commits (`chore: init project`). Continue with concise,
imperative subjects such as `feat: add profile page` or `fix: handle missing user id`. Keep commits
focused. Pull requests should explain the behavior change, list verification performed, link any
related issue, and include before/after screenshots for visible changes. Do not commit generated
output, dependencies, local environment files, or editor settings.

## Security & Configuration

Keep secrets in ignored `.env` files and document required keys in a committed `.env.example` using
placeholder values only. Treat all runtime input as untrusted and validate it at server boundaries.
