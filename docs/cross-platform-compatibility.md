# Cross-platform compatibility

This document is the source of truth for Spellbook desktop compatibility. The supported desktop platforms are Windows and macOS. Linux packaging and runtime behavior are out of scope.

## Path ownership

Electron startup creates one platform context from `process.platform`, `os.homedir()`, `app.getPath('userData')`, and the process environment. Services receive the resolved context; they must not rediscover platform state from `process.cwd()`, `process.platform`, or hard-coded separators.

| Purpose | Windows | macOS |
| --- | --- | --- |
| Electron user data | `%APPDATA%\\Spellbook` | `~/Library/Application Support/Spellbook` |
| Database | `<userData>\\data\\index.sqlite` | `<userData>/data/index.sqlite` |
| Packaged skills | `<userData>\\data\\packages` | `<userData>/data/packages` |
| Claude history | `%CLAUDE_CONFIG_DIR%` or `~\\.claude` | `$CLAUDE_CONFIG_DIR` or `~/.claude` |
| Codex history | `%CODEX_HOME%` or `~\\.codex` | `$CODEX_HOME` or `~/.codex` |
| Claude skills | `~\\.claude\\skills` | `~/.claude/skills` |
| Codex skills | `~\\.agents\\skills` | `~/.agents/skills` |

Persisted history overrides take precedence over defaults and must be absolute according to the current OS. Windows drive paths and complete `\\server\\share` UNC paths are valid on Windows; device namespaces such as `\\.\\` and `\\?\\`, incomplete UNC paths, paths from the other OS, and relative paths are rejected. Empty environment overrides use the provider default. Resetting a source restores the current platform/environment default. Skill roots remain fixed provider user directories.

The app is in active development and has no online users. This change directly switches local app data to Electron user data. It does not migrate, delete, or silently reuse the old `~/.spellbook` directory.

## Native and portable paths

OS paths use injected `node:path/win32` or `node:path/posix` operations. Skill manifests, `files[]`, and ZIP entry names use `/`-separated portable relative paths.

Every portable segment must satisfy the Windows/macOS intersection:

- no empty, `.` or `..` segments;
- no `/`, `\\`, control characters, or `< > : " | ? *`;
- no trailing dot or space;
- no Windows device name such as `CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, or `LPT1`-`LPT9`, including names with extensions.

Collision keys use Unicode NFC plus lower-case comparison. Any two entries with the same portable collision key reject the whole skill before staging or packaging. Existing target content must remain unchanged after rejection.

## Resources and local data errors

SQL.js WASM and runtime icons are build-time assets. Runtime code must not guess their location from the working directory. The database is created only when the database file is absent. Permission, lock, and corrupt-database failures are surfaced and must never fall back to a new empty database.

The renderer requests scans by target and provider only; the main process reads and validates the persisted source paths. Missing optional history roots are reported separately from unreadable or failed roots. A failed directory branch produces a structured error with its exact path while readable siblings continue scanning, and the UI reports partial scans as warnings or total failures as errors.

## Native shell behavior

- macOS keeps standard App, Edit, View, and Window menus. Its main window keeps visible traffic lights and its tray image is marked as a template with 1x and 2x representations.
- Windows keeps the custom title-bar controls, ICO window icon, and normal tray image.
- Electron accelerators use `CommandOrControl`; displayed shortcuts use `Cmd`/`Option` on macOS and `Ctrl`/`Alt` on Windows.

## Build and release acceptance

Both native platforms must run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`. `npm run package:win` and `npm run package:mac` create unsigned directory packages on their native OS. The packaged smoke must launch the real executable, load SQL WASM and tray/window resources, create the database and package directory below the expected Electron user-data root, record evidence, and exit cleanly.

Cross-host packaging or `npm run build` alone does not satisfy native packaged smoke. Signing, notarization, automatic updates, and Linux support remain outside this requirement.
