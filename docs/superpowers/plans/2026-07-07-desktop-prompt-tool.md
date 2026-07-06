# Desktop Prompt Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first usable Electron desktop prompt tool that can search/copy prompts, scan Codex and Claude Code history, generate candidates, export local assets, and show basic usage analytics.

**Architecture:** Electron owns privileged desktop operations such as global shortcuts, file access, clipboard writes, and local persistence. React renders the workspace and calls a typed preload API. Local services use a SQLite database file through `sql.js`, which avoids native module rebuild friction while still persisting a SQLite database.

**Tech Stack:** Electron, React, TypeScript, Vite, electron-vite, Vitest, sql.js, lucide-react.

---

## File Structure

- Create `package.json`: npm scripts and dependencies.
- Create `electron.vite.config.ts`: Electron main/preload/renderer build configuration.
- Create `tsconfig.json`, `tsconfig.node.json`: TypeScript compiler settings.
- Create `vitest.config.ts`: test configuration.
- Create `index.html`: renderer entry point.
- Create `desktop/shared/types.ts`: shared domain types.
- Create `desktop/main/index.ts`: Electron lifecycle, window, tray, global shortcut, IPC registration.
- Create `desktop/main/preload.ts`: safe renderer API bridge.
- Create `desktop/main/services/database.ts`: SQLite file load/save, schema, seed data.
- Create `desktop/main/services/parser.ts`: JSONL extraction, redaction, normalization, filtering.
- Create `desktop/main/services/ranker.ts`: category classification and candidate generation.
- Create `desktop/main/services/promptService.ts`: prompt search, candidate promotion, usage recording, analytics.
- Create `desktop/main/services/scanner.ts`: history source discovery and scan orchestration.
- Create `desktop/main/services/exporter.ts`: preview and confirmed local writes.
- Create `desktop/renderer/main.tsx`: React entry.
- Create `desktop/renderer/App.tsx`: app layout and navigation.
- Create `desktop/renderer/components/PromptPanel.tsx`: search, preview, copy.
- Create `desktop/renderer/components/LibraryView.tsx`: full prompt and candidate list.
- Create `desktop/renderer/components/ScannerView.tsx`: source discovery, scan run, scan summary.
- Create `desktop/renderer/components/AnalyticsView.tsx`: usage metrics.
- Create `desktop/renderer/components/ExportDialog.tsx`: export preview and confirmation.
- Create `desktop/renderer/styles.css`: compact desktop UI.
- Create `tests/fixtures/history.jsonl`: mixed JSONL fixture.
- Create `tests/parser.test.ts`: parser behavior tests.
- Create `tests/ranker.test.ts`: candidate grouping tests.
- Create `tests/exporter.test.ts`: preview/write tests.
- Create `tests/promptService.test.ts`: database/search/analytics tests.

## Task 1: Scaffold Tooling

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vitest.config.ts`
- Create: `index.html`

- [ ] **Step 1: Create npm scripts and dependencies**

Add scripts:

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "npm run typecheck && electron-vite build",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `node_modules` is created and `package-lock.json` is generated.

- [ ] **Step 3: Run baseline test command**

Run: `npm test`

Expected: Vitest reports no tests found or no test files before tests are added.

## Task 2: Shared Types And Parser

**Files:**
- Create: `desktop/shared/types.ts`
- Create: `desktop/main/services/parser.ts`
- Create: `tests/fixtures/history.jsonl`
- Create: `tests/parser.test.ts`

- [ ] **Step 1: Write failing parser tests**

Test required behaviors:

```ts
import { describe, expect, it } from 'vitest';
import { extractPromptsFromJsonl, normalizePrompt, redactSecrets } from '../desktop/main/services/parser';

describe('parser', () => {
  it('extracts user and human prompts while ignoring assistant and tool records', () => {
    const jsonl = [
      JSON.stringify({ role: 'user', content: 'review current diff for missing tests' }),
      JSON.stringify({ type: 'human', text: '帮我修复失败测试' }),
      JSON.stringify({ role: 'assistant', content: 'assistant answer' }),
      JSON.stringify({ type: 'tool_result', content: 'tool output' })
    ].join('\n');

    const result = extractPromptsFromJsonl(jsonl, {
      sourceTool: 'codex',
      sourceFile: 'fixture.jsonl'
    });

    expect(result.prompts.map((prompt) => prompt.rawText)).toEqual([
      'review current diff for missing tests',
      '帮我修复失败测试'
    ]);
    expect(result.warningCount).toBe(0);
  });

  it('redacts secrets before persistence', () => {
    expect(redactSecrets('API_KEY=sk-test123456 TOKEN=ghp_abcdef123456')).toContain('[REDACTED_SECRET]');
  });

  it('normalizes paths urls issues commits and code blocks', () => {
    const text = 'review src/app/Billing.tsx for https://example.com issue #128 commit abcdef1234567890';
    expect(normalizePrompt(text)).toContain('{{file_path}}');
    expect(normalizePrompt(text)).toContain('{{url}}');
    expect(normalizePrompt(text)).toContain('{{issue_id}}');
    expect(normalizePrompt(text)).toContain('{{commit_hash}}');
  });
});
```

- [ ] **Step 2: Run parser tests and verify RED**

Run: `npm test -- tests/parser.test.ts`

Expected: FAIL because `desktop/main/services/parser.ts` does not exist.

- [ ] **Step 3: Implement parser**

Implement exported functions:

```ts
export function extractPromptsFromJsonl(jsonl: string, options: ExtractOptions): ExtractResult;
export function redactSecrets(text: string): string;
export function normalizePrompt(text: string): string;
export function isLowValuePrompt(text: string): boolean;
```

- [ ] **Step 4: Run parser tests and verify GREEN**

Run: `npm test -- tests/parser.test.ts`

Expected: PASS.

## Task 3: Ranker And Candidate Generation

**Files:**
- Create: `desktop/main/services/ranker.ts`
- Create: `tests/ranker.test.ts`

- [ ] **Step 1: Write failing ranker tests**

```ts
import { describe, expect, it } from 'vitest';
import { generateCandidates } from '../desktop/main/services/ranker';

describe('ranker', () => {
  it('groups review diff prompts into a review-diff skill candidate', () => {
    const candidates = generateCandidates([
      { id: '1', rawText: '帮我 review 当前 diff', normalizedText: 'review diff', sourceTool: 'codex', projectPath: 'app', timestamp: '2026-07-01T00:00:00.000Z' },
      { id: '2', rawText: 'review current changes for edge cases', normalizedText: 'review current changes', sourceTool: 'claude', projectPath: 'api', timestamp: '2026-07-02T00:00:00.000Z' }
    ]);

    expect(candidates[0].slug).toBe('review-diff');
    expect(candidates[0].candidateType).toBe('skill');
    expect(candidates[0].sourceCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run ranker tests and verify RED**

Run: `npm test -- tests/ranker.test.ts`

Expected: FAIL because `generateCandidates` is missing.

- [ ] **Step 3: Implement deterministic candidate generation**

Implement category rules for at least `review_diff`, `debug_error`, `fix_tests`, `write_tests`, `refactor_code`, `explain_code`, `generate_commit_message`, and `implement_feature`.

- [ ] **Step 4: Run ranker tests and verify GREEN**

Run: `npm test -- tests/ranker.test.ts`

Expected: PASS.

## Task 4: SQLite Persistence And Prompt Service

**Files:**
- Create: `desktop/main/services/database.ts`
- Create: `desktop/main/services/promptService.ts`
- Create: `tests/promptService.test.ts`

- [ ] **Step 1: Write failing prompt service tests**

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../desktop/main/services/database';
import { createPromptService } from '../desktop/main/services/promptService';

describe('prompt service', () => {
  it('seeds starter prompts and searches by tag and body', async () => {
    const db = await createTestDatabase();
    const service = createPromptService(db);
    await service.seedStarterPrompts();

    const results = await service.searchPrompts('review');

    expect(results.some((prompt) => prompt.slug === 'review-diff')).toBe(true);
  });

  it('records usage and returns analytics', async () => {
    const db = await createTestDatabase();
    const service = createPromptService(db);
    await service.seedStarterPrompts();
    const [prompt] = await service.searchPrompts('commit');

    await service.copyPrompt(prompt.id);
    const analytics = await service.getAnalytics();

    expect(analytics.totalCopies).toBe(1);
  });
});
```

- [ ] **Step 2: Run prompt service tests and verify RED**

Run: `npm test -- tests/promptService.test.ts`

Expected: FAIL because database and service modules are missing.

- [ ] **Step 3: Implement SQLite wrapper and prompt service**

Use `sql.js` to create an in-memory test database and a persisted app database. Implement schema creation, starter prompts, search, usage events, candidate save, and analytics queries.

- [ ] **Step 4: Run prompt service tests and verify GREEN**

Run: `npm test -- tests/promptService.test.ts`

Expected: PASS.

## Task 5: Exporter Preview And Confirmed Writes

**Files:**
- Create: `desktop/main/services/exporter.ts`
- Create: `tests/exporter.test.ts`

- [ ] **Step 1: Write failing exporter tests**

```ts
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { previewExport, writeExport } from '../desktop/main/services/exporter';

describe('exporter', () => {
  it('previews a codex skill without writing', async () => {
    const preview = previewExport({ slug: 'review-diff', title: 'Review diff', description: 'Review changes', body: 'Review the current diff.' }, 'codex-skill', 'C:/tmp');
    expect(preview.path).toContain('review-diff');
    expect(preview.content).toContain('name: review-diff');
  });

  it('writes a snippet only after confirmation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'apm-export-'));
    const result = await writeExport({ slug: 'commit-message', title: 'Commit message', description: 'Generate commit message', body: 'Generate a commit message.' }, 'snippet', dir);
    const content = await readFile(result.path, 'utf8');
    expect(content).toContain('slug: commit-message');
    await rm(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run exporter tests and verify RED**

Run: `npm test -- tests/exporter.test.ts`

Expected: FAIL because exporter functions are missing.

- [ ] **Step 3: Implement exporter**

Implement preview and write for `snippet`, `claude-skill`, and `codex-skill`, using explicit target directories from the caller for testability.

- [ ] **Step 4: Run exporter tests and verify GREEN**

Run: `npm test -- tests/exporter.test.ts`

Expected: PASS.

## Task 6: Scanner Service

**Files:**
- Create: `desktop/main/services/scanner.ts`
- Modify: `tests/fixtures/history.jsonl`
- Create: `tests/scanner.test.ts`

- [ ] **Step 1: Write failing scanner tests**

```ts
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanJsonlFiles } from '../desktop/main/services/scanner';

describe('scanner', () => {
  it('scans jsonl files and ignores tool results', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'apm-scan-'));
    const file = join(dir, 'history.jsonl');
    await writeFile(file, [
      JSON.stringify({ role: 'user', content: 'review current diff' }),
      JSON.stringify({ role: 'assistant', content: 'assistant content' }),
      JSON.stringify({ type: 'tool_result', content: 'secret tool output' })
    ].join('\n'));

    const result = await scanJsonlFiles([file], 'codex');

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0].rawText).toBe('review current diff');
    await rm(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run scanner tests and verify RED**

Run: `npm test -- tests/scanner.test.ts`

Expected: FAIL because scanner functions are missing.

- [ ] **Step 3: Implement scanner**

Implement direct file scanning and default source discovery for `%USERPROFILE%\.claude` and `%USERPROFILE%\.codex`, skipping disallowed path segments.

- [ ] **Step 4: Run scanner tests and verify GREEN**

Run: `npm test -- tests/scanner.test.ts`

Expected: PASS.

## Task 7: Electron Main, Preload, And Renderer UI

**Files:**
- Create: `desktop/main/index.ts`
- Create: `desktop/main/preload.ts`
- Create: `desktop/renderer/main.tsx`
- Create: `desktop/renderer/App.tsx`
- Create: `desktop/renderer/components/PromptPanel.tsx`
- Create: `desktop/renderer/components/LibraryView.tsx`
- Create: `desktop/renderer/components/ScannerView.tsx`
- Create: `desktop/renderer/components/AnalyticsView.tsx`
- Create: `desktop/renderer/components/ExportDialog.tsx`
- Create: `desktop/renderer/styles.css`

- [ ] **Step 1: Implement Electron shell**

Create a hidden-friendly main window, register `CommandOrControl+Shift+Space`, expose IPC handlers, and seed starter prompts on startup.

- [ ] **Step 2: Implement preload API**

Expose:

```ts
window.apm = {
  searchPrompts(query),
  copyPrompt(id),
  getCandidates(),
  promoteCandidate(id),
  runScan(),
  getAnalytics(),
  previewExport(input),
  writeExport(input)
};
```

- [ ] **Step 3: Implement React workspace**

Use four views: Prompt Panel, Library, Scanner, Analytics. The first screen is the prompt workspace with a search input, result list, preview panel, and copy button.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

## Task 8: README And Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document commands**

Add commands:

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

- [ ] **Step 2: Run full automated verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`

Expected: Electron app opens to the prompt workspace. Search returns starter prompts. Copy records usage. Scan does not crash when no local history exists.

## Self-Review

Spec coverage:

1. Global hotkey and desktop workspace are covered by Task 7.
2. Search, copy, and usage analytics are covered by Tasks 4 and 7.
3. Local Codex and Claude scanning is covered by Tasks 2, 3, and 6.
4. SQLite persistence is covered by Task 4.
5. Export preview and confirmed writes are covered by Task 5 and Task 7.
6. README and verification are covered by Task 8.

Placeholder scan: no placeholder tasks remain. All steps name concrete files and verification commands.

Type consistency: shared names are `Prompt`, `Candidate`, `UsageAnalytics`, `searchPrompts`, `copyPrompt`, `runScan`, `previewExport`, and `writeExport` across planned services and preload API.
