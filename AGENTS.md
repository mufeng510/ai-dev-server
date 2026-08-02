# Repository Guidelines

## Project Structure & Module Organization

Production contracts live under `src/`, runtime and release helpers under `scripts/`, installers under `install/`, tests under `tests/`, and operator documentation under `docs/`. Docker runtime and build definitions are `Dockerfile`, `docker-compose.yml`, and `docker-bake.hcl`. Group modules by feature or service responsibility. Keep generated output in `dist/` or `build/`, and exclude it from version control.

## Build, Test, and Development Commands

Node.js 20 or newer runs the offline contract suite. Docker Compose v2 and Buildx are required for container configuration and image checks. Use these committed commands:

- `npm test` runs deterministic offline contract tests.
- `npm run lint` runs static validation and reports unavailable optional tools as skipped.
- `npm run validate` runs the offline suite plus available ShellCheck, Hadolint, Actionlint, Compose, and Bake checks.
- `npm run validate:strict` fails when an optional validation tool is unavailable.
- `docker buildx bake test` builds the image test target when Docker is available.

Run these review checks before submitting changes:

- `git status --short` shows tracked and untracked changes.
- `git diff --check` detects whitespace errors and unresolved conflict markers.
- `git diff --stat` provides a quick scope review.

Document skipped checks explicitly. Local offline validation is not evidence that Docker builds or native amd64/arm64 release gates passed.

## Coding Style & Naming Conventions

Follow the formatter and linter configured for the chosen language; commit their configuration with the first source files. Until then, use spaces rather than tabs, UTF-8 text, and a final newline. Prefer descriptive names: `PascalCase` for types, `camelCase` for functions and variables, and lowercase kebab-case for general filenames (for example, `request-handler.ts`). Keep modules focused and avoid committing generated files or editor-specific settings.

## Testing Guidelines

Add tests with every behavior change or bug fix. Mirror the source layout under `tests/`, and use names that identify the unit and expected behavior, such as `request-handler.test.ts`. Tests should be deterministic and must not require production credentials or network access unless explicitly marked as integration tests. Document the exact test and coverage commands when a framework is introduced.

## Commit & Pull Request Guidelines

The history currently contains only `Initial commit`, so no detailed convention is established. Use short, imperative commit subjects, optionally with a conventional prefix such as `feat:`, `fix:`, `test:`, or `docs:`. Keep commits narrowly scoped.

Pull requests should explain the problem, summarize the solution, list verification performed, and link related issues. Include screenshots or sample output for user-visible changes. Call out configuration changes, migrations, and known follow-up work explicitly.

## Security & Configuration

Never commit secrets, tokens, private keys, or populated environment files. Provide sanitized examples such as `.env.example`, validate required settings at startup, and keep local overrides ignored by Git.
