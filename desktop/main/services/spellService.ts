import { randomUUID } from 'node:crypto';
import { deriveSpellName } from '../../shared/spellNaming';
import {
  MAX_SPELL_TRAITS,
  type Candidate,
  type CandidatePromotionResult,
  type Spell,
  type SpellCreateInput,
  type SpellDeleteResult,
  type SpellStatePatch,
  type SpellUpdatePatch,
  type UsageAnalytics
} from '../../shared/types';
import type { AppDatabase } from './database';

interface SpellRow extends Record<string, unknown> {
  id: string;
  name: string;
  body: string;
  tags: string;
  source: string;
  is_favorite: number;
  is_blocked: number;
  created_at: string;
  updated_at: string;
  copy_count?: number;
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
  status: string;
  examples: string;
  created_at: string;
  updated_at: string;
}

const STARTER_SPELLS: Array<
  Omit<Spell, 'id' | 'isFavorite' | 'isBlocked' | 'createdAt' | 'updatedAt' | 'copyCount'>
> = [
  {
    name: 'Review current diff',
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
    name: 'Debug failing tests',
    body: 'Investigate the failing tests, identify the failing behavior, decide whether implementation or tests are wrong, and propose the smallest safe fix.',
    tags: ['debug', 'test'],
    source: 'starter'
  },
  {
    name: 'Generate commit message',
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
            (id, name, body, tags, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            spell.name,
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
          `SELECT spells.*, COUNT(usage_events.id) AS copy_count
           FROM spells
           LEFT JOIN usage_events ON usage_events.spell_id = spells.id AND usage_events.action = 'copy'
           WHERE spells.is_blocked = 0
             AND (lower(name) LIKE ?
               OR lower(body) LIKE ?
               OR lower(tags) LIKE ?)
           GROUP BY spells.id
           ORDER BY updated_at DESC, body ASC`,
          [normalized, normalized, normalized]
        )
        .map(rowToSpell);
    },

    async listSpells(): Promise<Spell[]> {
      return db
        .all<SpellRow>(
          `SELECT spells.*, COUNT(usage_events.id) AS copy_count
           FROM spells
           LEFT JOIN usage_events ON usage_events.spell_id = spells.id AND usage_events.action = 'copy'
           GROUP BY spells.id
           ORDER BY updated_at DESC, body ASC`
        )
        .map(rowToSpell);
    },

    async listPopularSpells(limit = 6): Promise<Spell[]> {
      return db
        .all<SpellRow>(
          `SELECT spells.*, COUNT(usage_events.id) AS copy_count
           FROM spells
           LEFT JOIN usage_events ON usage_events.spell_id = spells.id AND usage_events.action = 'copy'
           WHERE spells.is_blocked = 0
           GROUP BY spells.id
           ORDER BY copy_count DESC, spells.updated_at DESC, spells.body ASC
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
      if (Boolean(row.is_blocked)) {
        throw new Error(`Blocked spell cannot be copied: ${spellId}`);
      }
      db.run(
        'INSERT INTO usage_events (id, spell_id, action, created_at) VALUES (?, ?, ?, ?)',
        [randomUUID(), spellId, 'copy', new Date().toISOString()]
      );
      await db.save();
      return rowToSpell(row);
    },

    async createSpell(input: SpellCreateInput): Promise<Spell> {
      const row = insertSpell(db, input, 'manual');
      await db.save();
      return rowToSpell(row);
    },

    async createSpellFromCandidate(
      candidateId: string,
      input: SpellCreateInput
    ): Promise<Spell> {
      const candidate = db.get<CandidateRow>(
        "SELECT * FROM candidates WHERE id = ? AND status = 'pending'",
        [candidateId]
      );
      if (!candidate) {
        throw new Error(`Pending candidate not found: ${candidateId}`);
      }
      const now = new Date().toISOString();
      const row = insertSpell(db, input, 'candidate', now);
      db.run('UPDATE candidates SET status = ?, updated_at = ? WHERE id = ?', [
        'saved',
        now,
        candidateId
      ]);
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
      const name = patch.name === undefined ? current.name : patch.name.trim();
      const tags = patch.tags === undefined ? parseTags(current.tags) : validateTags(patch.tags);
      const now = new Date().toISOString();
      db.run(
        `UPDATE spells
         SET name = ?, body = ?, tags = ?, updated_at = ?
         WHERE id = ?`,
        [name, body, JSON.stringify(tags), now, spellId]
      );
      await db.save();
      const row = db.get<SpellRow>('SELECT * FROM spells WHERE id = ?', [spellId]);
      if (!row) {
        throw new Error(`Updated spell not found: ${spellId}`);
      }
      return rowToSpell(row);
    },

    async updateSpellState(spellId: string, patch: SpellStatePatch): Promise<Spell> {
      const current = db.get<SpellRow>('SELECT * FROM spells WHERE id = ?', [spellId]);
      if (!current) {
        throw new Error(`Spell not found: ${spellId}`);
      }
      const isBlocked = patch.isBlocked ?? Boolean(current.is_blocked);
      const isFavorite = isBlocked
        ? false
        : patch.isFavorite ?? Boolean(current.is_favorite);
      db.run('UPDATE spells SET is_favorite = ?, is_blocked = ? WHERE id = ?', [
        Number(isFavorite),
        Number(isBlocked),
        spellId
      ]);
      await db.save();
      const row = db.get<SpellRow>('SELECT * FROM spells WHERE id = ?', [spellId]);
      if (!row) {
        throw new Error(`Updated spell not found: ${spellId}`);
      }
      return rowToSpell(row);
    },

    async deleteSpell(spellId: string): Promise<void> {
      const result = await this.deleteSpells([spellId]);
      if (result.missingIds.includes(spellId)) {
        throw new Error(`Spell not found: ${spellId}`);
      }
    },

    async deleteSpells(spellIds: string[]): Promise<SpellDeleteResult> {
      const deletedIds: string[] = [];
      const missingIds: string[] = [];
      for (const spellId of normalizeIds(spellIds)) {
        const current = db.get<SpellRow>('SELECT * FROM spells WHERE id = ?', [spellId]);
        if (!current) {
          missingIds.push(spellId);
          continue;
        }
        db.run('DELETE FROM usage_events WHERE spell_id = ?', [spellId]);
        db.run('DELETE FROM spells WHERE id = ?', [spellId]);
        deletedIds.push(spellId);
      }
      await db.save();
      return { deletedIds, missingIds };
    },

    async saveCandidates(candidates: Candidate[]): Promise<void> {
      for (const candidate of candidates) {
        const existing = db.get<CandidateRow>('SELECT * FROM candidates WHERE slug = ?', [candidate.slug]);
        const status =
          existing?.status === 'saved' || findSpellByBody(db, candidate.template)
            ? 'saved'
            : candidate.status;
        db.run(
          `INSERT OR REPLACE INTO candidates
            (id, slug, title, description, template, candidate_type, source_count, status, examples, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            existing?.id ?? candidate.id,
            candidate.slug,
            candidate.title,
            candidate.description,
            candidate.template,
            candidate.candidateType,
            candidate.sourceCount,
            status,
            JSON.stringify(candidate.examples),
            existing?.created_at ?? candidate.createdAt,
            candidate.updatedAt
          ]
        );
      }
      await db.save();
    },

    async replaceCandidates(candidates: Candidate[]): Promise<void> {
      db.run('DELETE FROM candidates');
      await this.saveCandidates(candidates);
    },

    async listCandidates(): Promise<Candidate[]> {
      return db
        .all<CandidateRow>(
          "SELECT * FROM candidates WHERE status != 'ignored' ORDER BY source_count DESC, title ASC"
        )
        .map(rowToCandidate);
    },

    async promoteCandidates(candidateIds: string[]): Promise<CandidatePromotionResult> {
      const now = new Date().toISOString();
      const result: CandidatePromotionResult = { created: [], skipped: [] };
      for (const candidateId of normalizeIds(candidateIds)) {
        const candidate = db.get<CandidateRow>('SELECT * FROM candidates WHERE id = ?', [candidateId]);
        if (!candidate) {
          result.skipped.push({ candidateId, reason: 'missing' });
          continue;
        }
        const existing = findSpellByBody(db, candidate.template);
        if (existing) {
          db.run('UPDATE candidates SET status = ?, updated_at = ? WHERE id = ?', ['saved', now, candidateId]);
          result.skipped.push({ candidateId, reason: 'duplicate' });
          continue;
        }
        const row = insertSpell(
          db,
          {
            name: deriveSpellName(candidate.template, candidate.title),
            body: candidate.template,
            tags: []
          },
          'candidate',
          now
        );
        db.run('UPDATE candidates SET status = ?, updated_at = ? WHERE id = ?', ['saved', now, candidateId]);
        result.created.push(rowToSpell(row));
      }
      await db.save();
      return result;
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
         WHERE usage_events.action = 'copy' AND spells.is_blocked = 0
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
    name: row.name ?? '',
    body: row.body,
    tags: parseTags(row.tags),
    source: row.source,
    isFavorite: Boolean(row.is_favorite),
    isBlocked: Boolean(row.is_blocked),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    copyCount: Number(row.copy_count ?? 0)
  };
}

function insertSpell(
  db: AppDatabase,
  input: SpellCreateInput,
  source: 'manual' | 'candidate',
  now = new Date().toISOString()
): SpellRow {
  if (!input.body.trim()) {
    throw new Error('Spell body cannot be empty');
  }
  const spellId = randomUUID();
  db.run(
    `INSERT INTO spells
      (id, name, body, tags, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      spellId,
      input.name?.trim() ?? '',
      input.body,
      JSON.stringify(validateTags(input.tags ?? [])),
      source,
      now,
      now
    ]
  );
  const row = db.get<SpellRow>('SELECT * FROM spells WHERE id = ?', [spellId]);
  if (!row) {
    throw new Error(`Created spell not found: ${spellId}`);
  }
  return row;
}

function normalizeTags(tags: string[]): string[] {
  return collectNormalizedTags(tags).slice(0, MAX_SPELL_TRAITS);
}

function validateTags(tags: string[]): string[] {
  const normalized = collectNormalizedTags(tags);
  if (normalized.length > MAX_SPELL_TRAITS) {
    throw new Error(`A spell can have at most ${MAX_SPELL_TRAITS} traits`);
  }
  return normalized;
}

function collectNormalizedTags(tags: string[]): string[] {
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

function findSpellByBody(db: AppDatabase, body: string): Spell | null {
  const normalizedBody = normalizeBodyForDedupe(body);
  const row = db
    .all<SpellRow>('SELECT * FROM spells')
    .find((spell) => normalizeBodyForDedupe(spell.body) === normalizedBody);
  return row ? rowToSpell(row) : null;
}

function normalizeBodyForDedupe(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeIds(ids: string[]): string[] {
  const normalized: string[] = [];
  for (const id of ids) {
    if (id && !normalized.includes(id)) {
      normalized.push(id);
    }
  }
  return normalized;
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
    status: row.status as Candidate['status'],
    examples: JSON.parse(row.examples) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
