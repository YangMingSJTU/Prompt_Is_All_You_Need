# Repository Guidelines

## Project Structure & Module Organization

This repository contains the Spellbook desktop app. Root files include `README.md`, `LICENSE`, package/tooling config, and `AGENTS.md`.

- `desktop/main/` contains Electron main-process services and IPC.
- `desktop/renderer/` contains the React UI.
- `desktop/shared/` contains shared types and app settings helpers.
- `tests/` contains Vitest coverage for services, UI structure, and shared helpers.
- `assets/` and `docs/` contain app assets and product notes.

## Development Stage

The project is in active development and has no online users. Favor simple current-state changes over compatibility layers; do not add legacy fallback logic, historical migrations, or backward-compatibility branches unless explicitly required.

## Build, Test, and Development Commands

Use npm scripts from `package.json`:

- `npm test` runs the Vitest suite.
- `npm run typecheck` runs TypeScript checks for renderer and main code.
- `npm run build` runs typecheck and builds the Electron app.
- `npm run dev` starts the local Electron development app.

Use `git status --short` and `git diff` before staging changes.

## Coding Style & Naming Conventions

Use Markdown for docs. Keep headings descriptive, paragraphs short, and examples runnable. Prefer ASCII unless a file already uses another character set or content requires it.

Follow the existing TypeScript and React style. Keep UI state local unless it is shared state, and prefer small reusable components over repeated JSX. Support Windows and macOS: use cross-platform path handling, avoid hardcoded separators or shell-specific commands, and document OS-specific setup.

## UI Interaction Guidance

For click-triggered result feedback such as copy, save, scan, package, or install, use a window-top centered Toast. Do not use Tooltip or persistent topbar/global status text for routine confirmations. Reserve Tooltip for hover detail and inline messages for actionable errors, validation problems, or required warnings.

## Testing Guidelines

Add or update tests for non-trivial behavior changes. Place tests under `tests/` and use `*.test.ts` naming. For UI-only constraints that are hard to exercise in DOM tests, static structure tests are acceptable when they directly protect a known regression.

## Commit & Pull Request Guidelines

Use concise, imperative commit messages, for example `Add prompt examples` or `Document test setup`.

Pull requests should include a clear summary, validation steps, and screenshots or previews when changing diagrams or visual documentation.

## Agent-Specific Instructions

When creating diagrams or images, keep them clean, simple, and well-proportioned. Include a brief explanation with each visual so readers can understand its purpose without extra context.
