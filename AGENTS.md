# Repository Guidelines

## Project Structure & Module Organization

This repository is a lightweight skeleton. Root files:

- `README.md` for title and description.
- `LICENSE` with Apache 2.0 terms.
- `AGENTS.md` for contributor and agent guidance.

No implementation directories exist yet. When adding work, use `src/` for code, `tests/` for tests that mirror `src/`, `docs/` for design notes, and `assets/` for images or sample data. Keep root-level files limited to metadata and tooling configuration.

## Development Stage

The project is in active development and has no online users. Favor simple current-state changes over compatibility layers; do not add legacy fallback logic, historical migrations, or backward-compatibility branches unless explicitly required.

## Build, Test, and Development Commands

No build system, package manager, or test runner is configured yet. Until tooling exists, use Git checks:

- `git status --short` shows changed and untracked files.
- `git diff` reviews unstaged edits.
- `git log --oneline -5` checks recent commit style.

When introducing a language stack, add canonical commands to `README.md` and keep this section in sync, for example `npm test`, `pytest`, or `make build`.

## Coding Style & Naming Conventions

Use Markdown for documentation. Keep headings descriptive, paragraphs short, and examples runnable where possible. Prefer ASCII unless a file already uses another character set or content requires it.

For future code, follow the formatter and linter standard for the chosen language. Name files and directories in lowercase with hyphens or underscores unless the ecosystem has a stronger convention.

## Testing Guidelines

No automated tests are present yet. Add tests with the first non-trivial implementation. Place them under `tests/`, mirror source layout, and name files according to the selected framework, such as `test_*.py`, `*.test.ts`, or `*_test.go`.

Document how to run the full suite and any focused test command before merging new code.

## Commit & Pull Request Guidelines

The current history contains only an initial commit, so no project-specific convention has been established. Use concise, imperative commit messages, for example `Add prompt examples` or `Document test setup`.

Pull requests should include a clear summary, validation steps, and screenshots or previews when changing diagrams or visual documentation.

## Agent-Specific Instructions

When creating diagrams or images, keep them clean, simple, and well-proportioned. Include a brief explanation with each visual so readers can understand its purpose without extra context.
