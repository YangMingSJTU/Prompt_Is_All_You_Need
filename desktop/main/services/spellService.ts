import { randomUUID } from 'node:crypto';
import type { Candidate, Spell, SpellUpdatePatch, UsageAnalytics } from '../../shared/types';
import type { AppDatabase } from './database';

interface SpellRow extends Record<string, unknown> {
  id: string;
  alias: string;
  body: string;
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

const STARTER_SPELLS: Array<Omit<Spell, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    alias: 'Review current diff',
    body: [
      'Review the current git diff.',
      '',
      'Focus on correctness bugs, edge cases, missing tests, regressions, unnecessary complexity, and inconsistency with existing code patterns.',
      '',
      'Do not modify files yet. Return prioritized findings.'
    ].join('\n'),
    tags: ['review', 'diff'],
    source: 'starter'
  },
  {
    alias: 'Debug failing tests',
    body: 'Investigate the failing tests, identify the failing behavior, decide whether implementation or tests are wrong, and propose the smallest safe fix.',
    tags: ['debug', 'test'],
    source: 'starter'
  },
  {
    alias: 'Generate commit message',
    body: 'Generate a concise commit message for the current changes.\n\nFormat:\n<type>: <summary>\n\nBody:\n- What changed\n- Why it changed\n- Testing notes',
    tags: ['git', 'commit'],
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
            (id, alias, body, tags, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            spell.alias,
            spell.body,
            JSON.stringify(spell.tags),
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
           WHERE lower(alias) LIKE ?
              OR lower(body) LIKE ?
              OR lower(tags) LIKE ?
           ORDER BY updated_at DESC, body ASC`,
          [normalized, normalized, normalized]
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

    async updateSpell(spellId: string, patch: SpellUpdatePatch): Promise<Spell> {
      const current = db.get<SpellRow>('SELECT * FROM spells WHERE id = ?', [spellId]);
      if (!current) {
        throw new Error(`Spell not found: ${spellId}`);
      }
      const body = patch.body ?? current.body;
      if (!body.trim()) {
        throw new Error('Spell body cannot be empty');
      }
      const alias = patch.alias === undefined ? current.alias : patch.alias.trim();
      const tags = patch.tags === undefined ? parseTags(current.tags) : normalizeTags(patch.tags);
      const now = new Date().toISOString();
      db.run(
        `UPDATE spells
         SET alias = ?, body = ?, tags = ?, updated_at = ?
         WHERE id = ?`,
        [alias, body, JSON.stringify(tags), now, spellId]
      );
      await db.save();
      const row = db.get<SpellRow>('SELECT * FROM spells WHERE id = ?', [spellId]);
      if (!row) {
        throw new Error(`Updated spell not found: ${spellId}`);
      }
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
          (id, alias, body, tags, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          spellId,
          candidate.title,
          candidate.template,
          JSON.stringify([]),
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
    alias: row.alias ?? '',
    body: row.body,
    tags: parseTags(row.tags),
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeTags(tags: string[]): string[] {
  const normalized: string[] = [];
  for (const tag of tags) {
    const value = tag.trim();
    if (value && !normalized.includes(value)) {
      normalized.push(value);
    }
  }
  return normalized;
}

function parseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? normalizeTags(parsed.filter((tag): tag is string => typeof tag === 'string'))
      : [];
  } catch {
    return [];
  }
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
