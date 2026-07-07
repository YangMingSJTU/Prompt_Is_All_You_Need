# Prompt_Is_All_You_Need

Agent Prompt Miner is a local-first desktop prompt launcher and miner for Codex and Claude Code users.

## Desktop MVP

The first desktop version provides:

- Electron desktop workspace with a global prompt-panel hotkey.
- Main workspace for library, scan, export, and analytics.
- Small floating quick panel opened by `Ctrl+Shift+Space`.
- Starter prompt library for review, debugging tests, and commit messages.
- Prompt search, preview, copy, and local usage analytics.
- Chinese and English UI copy, selected from the local language with Chinese fallback.
- Local Claude/Codex JSONL scanning that only extracts user/human prompts.
- Candidate generation from local history.
- Preview and confirmed export for snippets, Claude Skills, and Codex Skills.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

The app stores its SQLite database in the Electron user-data directory during normal desktop use. It does not upload prompts, call remote LLMs, or read assistant/tool-result content by default.
