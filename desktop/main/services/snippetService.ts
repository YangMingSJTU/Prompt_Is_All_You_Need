import { randomUUID } from 'node:crypto';
import type { Candidate, Snippet, UsageAnalytics } from '../../shared/types';
import type { AppDatabase } from './database';

interface SnippetRow extends Record<string, unknown> {
  id: string;
  slug: string;
  title: string;
  body: string;
  description: string;
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

const STARTER_SNIPPETS: Array<Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>> = [
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
    tags: ['review', 'codex', 'claude', 'diff'],
    source: 'starter'
  },
  {
    slug: 'debug-failing-tests',
    title: 'Debug failing tests',
    body: 'Investigate the failing tests, identify the failing behavior, decide whether implementation or tests are wrong, and propose the smallest safe fix.',
    description: 'Debug failing tests with minimal, verified changes.',
    tags: ['tests', 'debug', 'codex', 'claude'],
    source: 'starter'
  },
  {
    slug: 'commit-message',
    title: 'Generate commit message',
    body: 'Generate a concise commit message for the current changes.\n\nFormat:\n<type>: <summary>\n\nBody:\n- What changed\n- Why it changed\n- Testing notes',
    description: 'Generate a concise commit message from the current diff.',
    tags: ['git', 'commit', 'summary'],
    source: 'starter'
  }
];

export function createSnippetService(db: AppDatabase) {
  return {
    async seedStarterSnippets(): Promise<void> {
      const now = new Date().toISOString();
      for (const snippet of STARTER_SNIPPETS) {
        db.run(
          `INSERT OR IGNORE INTO snippets
            (id, slug, title, body, description, tags, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            snippet.slug,
            snippet.title,
            snippet.body,
            snippet.description,
            JSON.stringify(snippet.tags),
            snippet.source,
            now,
            now
          ]
        );
      }
      await db.save();
    },

    async searchSnippets(query: string): Promise<Snippet[]> {
      const normalized = `%${query.toLowerCase()}%`;
      return db
        .all<SnippetRow>(
          `SELECT * FROM snippets
           WHERE lower(title) LIKE ?
              OR lower(body) LIKE ?
              OR lower(description) LIKE ?
              OR lower(tags) LIKE ?
           ORDER BY updated_at DESC, title ASC`,
          [normalized, normalized, normalized, normalized]
        )
        .map(rowToSnippet);
    },

    async listSnippets(): Promise<Snippet[]> {
      return db
        .all<SnippetRow>('SELECT * FROM snippets ORDER BY updated_at DESC, title ASC')
        .map(rowToSnippet);
    },

    async listPopularSnippets(limit = 6): Promise<Snippet[]> {
      return db
        .all<SnippetRow>(
          `SELECT snippets.*
           FROM snippets
           LEFT JOIN usage_events ON usage_events.snippet_id = snippets.id AND usage_events.action = 'copy'
           GROUP BY snippets.id
           ORDER BY COUNT(usage_events.id) DESC, snippets.updated_at DESC, snippets.title ASC
           LIMIT ?`,
          [limit]
        )
        .map(rowToSnippet);
    },

    async copySnippet(snippetId: string): Promise<Snippet> {
      const row = db.get<SnippetRow>('SELECT * FROM snippets WHERE id = ?', [snippetId]);
      if (!row) {
        throw new Error(`Snippet not found: ${snippetId}`);
      }
      db.run(
        'INSERT INTO usage_events (id, snippet_id, action, created_at) VALUES (?, ?, ?, ?)',
        [randomUUID(), snippetId, 'copy', new Date().toISOString()]
      );
      await db.save();
      return rowToSnippet(row);
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

    async promoteCandidate(candidateId: string): Promise<Snippet> {
      const candidate = db.get<CandidateRow>('SELECT * FROM candidates WHERE id = ?', [candidateId]);
      if (!candidate) {
        throw new Error(`Candidate not found: ${candidateId}`);
      }
      const now = new Date().toISOString();
      db.run(
        `INSERT OR REPLACE INTO snippets
          (id, slug, title, body, description, tags, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          candidate.slug,
          candidate.title,
          candidate.template,
          candidate.description,
          JSON.stringify(['candidate']),
          'candidate',
          now,
          now
        ]
      );
      db.run('UPDATE candidates SET status = ?, updated_at = ? WHERE id = ?', ['saved', now, candidateId]);
      await db.save();
      const row = db.get<SnippetRow>('SELECT * FROM snippets WHERE slug = ?', [candidate.slug]);
      if (!row) {
        throw new Error(`Promoted snippet not found: ${candidate.slug}`);
      }
      return rowToSnippet(row);
    },

    async getAnalytics(): Promise<UsageAnalytics> {
      const snippetCount = db.get<CountRow>('SELECT COUNT(*) AS count FROM snippets')?.count ?? 0;
      const skillCount = db.get<CountRow>('SELECT COUNT(*) AS count FROM skills')?.count ?? 0;
      const candidateCount = db.get<CountRow>('SELECT COUNT(*) AS count FROM candidates')?.count ?? 0;
      const totalCopies =
        db.get<CountRow>("SELECT COUNT(*) AS count FROM usage_events WHERE action = 'copy'")?.count ?? 0;
      const topSnippets = db.all<{ id: string; title: string; copyCount: number }>(
        `SELECT snippets.id AS id, snippets.title AS title, COUNT(usage_events.id) AS copyCount
         FROM usage_events
         JOIN snippets ON snippets.id = usage_events.snippet_id
         WHERE usage_events.action = 'copy'
         GROUP BY snippets.id, snippets.title
         ORDER BY copyCount DESC, snippets.title ASC
         LIMIT 5`
      );

      return {
        snippetCount,
        skillCount,
        candidateCount,
        totalCopies,
        topSnippets
      };
    }
  };
}

function rowToSnippet(row: SnippetRow): Snippet {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    description: row.description,
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
