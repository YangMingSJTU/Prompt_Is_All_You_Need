import { randomUUID } from 'node:crypto';
import type { Candidate, Spell, UsageAnalytics } from '../../shared/types';
import type { AppDatabase } from './database';

interface SpellRow extends Record<string, unknown> {
  id: string;
  body: string;
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

const STARTER_SPELLS: Array<Omit<Spell, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    body: [
      'Review the current git diff.',
      '',
      'Focus on correctness bugs, edge cases, missing tests, regressions, unnecessary complexity, and inconsistency with existing code patterns.',
      '',
      'Do not modify files yet. Return prioritized findings.'
    ].join('\n'),
    source: 'starter'
  },
  {
    body: 'Investigate the failing tests, identify the failing behavior, decide whether implementation or tests are wrong, and propose the smallest safe fix.',
    source: 'starter'
  },
  {
    body: 'Generate a concise commit message for the current changes.\n\nFormat:\n<type>: <summary>\n\nBody:\n- What changed\n- Why it changed\n- Testing notes',
    source: 'starter'
  }
];

export function createSpellService(db: AppDatabase) {
  return {
    async seedStarterSpells(): Promise<void> {
      const now = new Date().toISOString();
      for (const spell of STARTER_SPELLS) {
        db.run(
          `INSERT OR IGNORE INTO spells
            (id, body, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            spell.body,
            spell.source,
            now,
            now
          ]
        );
      }
      await db.save();
    },

    async searchSpells(query: string): Promise<Spell[]> {
      const normalized = `%${query.toLowerCase()}%`;
      return db
        .all<SpellRow>(
          `SELECT * FROM spells
           WHERE lower(body) LIKE ?
           ORDER BY updated_at DESC, body ASC`,
          [normalized]
        )
        .map(rowToSpell);
    },

    async listSpells(): Promise<Spell[]> {
      return db
        .all<SpellRow>('SELECT * FROM spells ORDER BY updated_at DESC, body ASC')
        .map(rowToSpell);
    },

    async listPopularSpells(limit = 6): Promise<Spell[]> {
      return db
        .all<SpellRow>(
          `SELECT spells.*
           FROM spells
           LEFT JOIN usage_events ON usage_events.spell_id = spells.id AND usage_events.action = 'copy'
           GROUP BY spells.id
           ORDER BY COUNT(usage_events.id) DESC, spells.updated_at DESC, spells.body ASC
           LIMIT ?`,
          [limit]
        )
        .map(rowToSpell);
    },

    async copySpell(spellId: string): Promise<Spell> {
      const row = db.get<SpellRow>('SELECT * FROM spells WHERE id = ?', [spellId]);
      if (!row) {
        throw new Error(`Spell not found: ${spellId}`);
      }
      db.run(
        'INSERT INTO usage_events (id, spell_id, action, created_at) VALUES (?, ?, ?, ?)',
        [randomUUID(), spellId, 'copy', new Date().toISOString()]
      );
      await db.save();
      return rowToSpell(row);
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

    async promoteCandidate(candidateId: string): Promise<Spell> {
      const candidate = db.get<CandidateRow>('SELECT * FROM candidates WHERE id = ?', [candidateId]);
      if (!candidate) {
        throw new Error(`Candidate not found: ${candidateId}`);
      }
      const now = new Date().toISOString();
      const spellId = randomUUID();
      db.run(
        `INSERT OR REPLACE INTO spells
          (id, body, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          spellId,
          candidate.template,
          'candidate',
          now,
          now
        ]
      );
      db.run('UPDATE candidates SET status = ?, updated_at = ? WHERE id = ?', ['saved', now, candidateId]);
      await db.save();
      const row = db.get<SpellRow>('SELECT * FROM spells WHERE id = ?', [spellId]);
      if (!row) {
        throw new Error(`Promoted spell not found: ${spellId}`);
      }
      return rowToSpell(row);
    },

    async getAnalytics(): Promise<UsageAnalytics> {
      const spellCount = db.get<CountRow>('SELECT COUNT(*) AS count FROM spells')?.count ?? 0;
      const skillCount = db.get<CountRow>('SELECT COUNT(*) AS count FROM skills')?.count ?? 0;
      const candidateCount = db.get<CountRow>('SELECT COUNT(*) AS count FROM candidates')?.count ?? 0;
      const totalCopies =
        db.get<CountRow>("SELECT COUNT(*) AS count FROM usage_events WHERE action = 'copy'")?.count ?? 0;
      const topSpells = db.all<{ id: string; body: string; copyCount: number }>(
        `SELECT spells.id AS id, spells.body AS body, COUNT(usage_events.id) AS copyCount
         FROM usage_events
         JOIN spells ON spells.id = usage_events.spell_id
         WHERE usage_events.action = 'copy'
         GROUP BY spells.id, spells.body
         ORDER BY copyCount DESC, spells.body ASC
         LIMIT 5`
      );

      return {
        spellCount,
        skillCount,
        candidateCount,
        totalCopies,
        topSpells
      };
    }
  };
}

function rowToSpell(row: SpellRow): Spell {
  return {
    id: row.id,
    body: row.body,
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
