# Skill library technical design

The skill library scans and operates on two fixed user roots: `~/.claude/skills` and `~/.agents/skills`. The Electron startup layer resolves both roots with the current platform path implementation and injects them into the service.

## Path model

The service keeps two path domains separate:

- Native absolute paths use the injected Windows or POSIX path operations for filesystem access.
- Skill `files[]`, manifest entries, and ZIP entry names are normalized portable relative paths with `/` separators.

Every portable path is validated against the Windows/macOS intersection before scanning, staging, installing, or packaging. Reserved Windows device names, trailing dots/spaces, invalid characters, absolute paths, traversal, and Unicode/case-folded collisions reject the whole operation. Validation happens before writes, so rejected input cannot partially replace an installed skill.

## Service boundaries

`skillScanner` discovers a root and produces validated portable metadata. `skillOperations` performs staging, collision checks, package creation, and atomic target replacement. `skillService` coordinates database state and owns no implicit home-directory or platform lookup.

Missing configured roots are reported as missing. Permission and other I/O errors are surfaced as explicit scan failures. Windows rename retry behavior remains an injected platform branch so it is testable from either host.

## Compatibility and acceptance

This repository has no online users, so the current portable contract is applied directly without legacy aliases or migration branches. The complete rules and native package acceptance matrix are maintained in [`cross-platform-compatibility.md`](cross-platform-compatibility.md).

Relevant regression coverage:

- `tests/portableSkillPath.test.ts`
- `tests/skillLibrary.test.ts`
- `tests/skillScanner.test.ts`
- `tests/skillService.test.ts`

A change to path rules is incomplete until the Windows and macOS native package smoke jobs both pass.
