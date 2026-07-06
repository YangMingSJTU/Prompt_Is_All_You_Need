import { randomUUID } from 'node:crypto';
import type { Candidate, ExportTarget, Prompt, UsageAnalytics } from '../../shared/types';
import type { AppDatabase } from './database';

interface PromptRow extends Record<string, unknown> {
  id: string;
  slug: string;
  title: string;
  body: string;
  description: string;
  prompt_type: string;
  tags: string;
  source: string;
  created_at: string;
  updated_at: string;
}

interface CountRow extends Record<string, unknown> {
  count: number;
}

interface CandidateRow extends Record<string, unknown> {
  id: string;
  slug: string;
  title: string;
  description: string;
  template: string;
  candidate_type: string;
  source_count: number;
  score: number;
  status: string;
  examples: string;
  created_at: string;
  updated_at: string;
}

const STARTER_PROMPTS: Array<Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    slug: 'review-diff',
    title: 'Review current diff',
    body: [
      'Review the current git diff.',
      '',
      'Focus on correctness bugs, edge cases, missing tests, regressions, unnecessary complexity, and inconsistency with existing code patterns.',
      '',
      'Do not modify files yet. Return prioritized findings.'
    ].join('\n'),
    description: 'Review current changes for bugs, edge cases, regressions, and missing tests.',
    promptType: 'skill',
    tags: ['review', 'codex', 'claude', 'diff'],
    source: 'starter'
  },
  {
    slug: 'debug-failing-tests',
    title: 'Debug failing tests',
    body: 'Investigate the failing tests, identify the failing behavior, decide whether implementation or tests are wrong, and propose the smallest safe fix.',
    description: 'Debug failing tests with minimal, verified changes.',
    promptType: 'skill',
    tags: ['tests', 'debug', 'codex', 'claude'],
    source: 'starter'
  },
  {
    slug: 'commit-message',
    title: 'Generate commit message',
    body: 'Generate a concise commit message for the current changes.\n\nFormat:\n<type>: <summary>\n\nBody:\n- What changed\n- Why it changed\n- Testing notes',
    description: 'Generate a concise commit message from the current diff.',
    promptType: 'snippet',
    tags: ['git', 'commit', 'summary'],
    source: 'starter'
  }
];

export function createPromptService(db: AppDatabase) {
  return {
    async seedStarterPrompts(): Promise<void> {
      const now = new Date().toISOString();
      for (const prompt of STARTER_PROMPTS) {
        db.run(
          `INSERT OR IGNORE INTO prompts
            (id, slug, title, body, description, prompt_type, tags, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            prompt.slug,
            prompt.title,
            prompt.body,
            prompt.description,
            prompt.promptType,
            JSON.stringify(prompt.tags),
            prompt.source,
            now,
            now
          ]
        );
      }
      await db.save();
    },

    async searchPrompts(query: string): Promise<Prompt[]> {
      const normalized = `%${query.toLowerCase()}%`;
      return db
        .all<PromptRow>(
          `SELECT * FROM prompts
           WHERE lower(title) LIKE ?
              OR lower(body) LIKE ?
              OR lower(description) LIKE ?
              OR lower(tags) LIKE ?
           ORDER BY updated_at DESC, title ASC`,
          [normalized, normalized, normalized, normalized]
        )
        .map(rowToPrompt);
    },

    async listPrompts(): Promise<Prompt[]> {
      return db
        .all<PromptRow>('SELECT * FROM prompts ORDER BY updated_at DESC, title ASC')
        .map(rowToPrompt);
    },

    async copyPrompt(promptId: string): Promise<Prompt> {
      const row = db.get<PromptRow>('SELECT * FROM prompts WHERE id = ?', [promptId]);
      if (!row) {
        throw new Error(`Prompt not found: ${promptId}`);
      }
      db.run(
        'INSERT INTO usage_events (id, prompt_id, action, created_at) VALUES (?, ?, ?, ?)',
        [randomUUID(), promptId, 'copy', new Date().toISOString()]
      );
      await db.save();
      return rowToPrompt(row);
    },

    async saveCandidates(candidates: Candidate[]): Promise<void> {
      for (const candidate of candidates) {
        db.run(
          `INSERT OR REPLACE INTO candidates
            (id, slug, title, description, template, candidate_type, source_count, score, status, examples, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            candidate.id,
            candidate.slug,
            candidate.title,
            candidate.description,
            candidate.template,
            candidate.candidateType,
            candidate.sourceCount,
            candidate.score,
            candidate.status,
            JSON.stringify(candidate.examples),
            candidate.createdAt,
            candidate.updatedAt
          ]
        );
      }
      await db.save();
    },

    async listCandidates(): Promise<Candidate[]> {
      return db
        .all<CandidateRow>(
          "SELECT * FROM candidates WHERE status != 'ignored' ORDER BY score DESC, source_count DESC, updated_at DESC"
        )
        .map(rowToCandidate);
    },

    async promoteCandidate(candidateId: string): Promise<Prompt> {
      const candidate = db.get<CandidateRow>('SELECT * FROM candidates WHERE id = ?', [candidateId]);
      if (!candidate) {
        throw new Error(`Candidate not found: ${candidateId}`);
      }
      const now = new Date().toISOString();
      db.run(
        `INSERT OR REPLACE INTO prompts
          (id, slug, title, body, description, prompt_type, tags, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          candidate.slug,
          candidate.title,
          candidate.template,
          candidate.description,
          candidate.candidate_type,
          JSON.stringify(['candidate', candidate.candidate_type]),
          'candidate',
          now,
          now
        ]
      );
      db.run('UPDATE candidates SET status = ?, updated_at = ? WHERE id = ?', ['saved', now, candidateId]);
      await db.save();
      const row = db.get<PromptRow>('SELECT * FROM prompts WHERE slug = ?', [candidate.slug]);
      if (!row) {
        throw new Error(`Promoted prompt not found: ${candidate.slug}`);
      }
      return rowToPrompt(row);
    },

    async recordExport(input: {
      promptId?: string | null;
      candidateId?: string | null;
      assetType: ExportTarget;
      path: string;
    }): Promise<void> {
      db.run(
        `INSERT INTO exported_assets (id, prompt_id, candidate_id, asset_type, path, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          input.promptId ?? null,
          input.candidateId ?? null,
          input.assetType,
          input.path,
          new Date().toISOString()
        ]
      );
      await db.save();
    },

    async getAnalytics(): Promise<UsageAnalytics> {
      const promptCount = db.get<CountRow>('SELECT COUNT(*) AS count FROM prompts')?.count ?? 0;
      const candidateCount = db.get<CountRow>('SELECT COUNT(*) AS count FROM candidates')?.count ?? 0;
      const exportedAssetCount =
        db.get<CountRow>('SELECT COUNT(*) AS count FROM exported_assets')?.count ?? 0;
      const totalCopies =
        db.get<CountRow>("SELECT COUNT(*) AS count FROM usage_events WHERE action = 'copy'")?.count ?? 0;
      const topPrompts = db.all<{ id: string; title: string; copyCount: number }>(
        `SELECT prompts.id AS id, prompts.title AS title, COUNT(usage_events.id) AS copyCount
         FROM usage_events
         JOIN prompts ON prompts.id = usage_events.prompt_id
         WHERE usage_events.action = 'copy'
         GROUP BY prompts.id, prompts.title
         ORDER BY copyCount DESC, prompts.title ASC
         LIMIT 5`
      );

      return {
        promptCount,
        candidateCount,
        exportedAssetCount,
        totalCopies,
        topPrompts
      };
    }
  };
}

function rowToPrompt(row: PromptRow): Prompt {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    description: row.description,
    promptType: row.prompt_type as Prompt['promptType'],
    tags: JSON.parse(row.tags) as string[],
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToCandidate(row: CandidateRow): Candidate {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    template: row.template,
    candidateType: row.candidate_type as Candidate['candidateType'],
    sourceCount: row.source_count,
    score: row.score,
    status: row.status as Candidate['status'],
    examples: JSON.parse(row.examples) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
