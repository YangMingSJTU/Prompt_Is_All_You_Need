import { describe, expect, it } from 'vitest';
import {
  BOOK_ARTWORK_SPREAD_COUNT,
  BOOK_PAGE_TEXTURE_HEIGHT,
  BOOK_PAGE_TEXTURE_WIDTH,
  BOOK_PAGE_WRITING_WIDTH,
  createBookArtworkDeck
} from '../desktop/renderer/bookPageArtwork';

describe('recommendation book page artwork', () => {
  it('builds a deterministic deck for one library visit', () => {
    const first = createBookArtworkDeck('library-visit-seed', 4);
    const repeated = createBookArtworkDeck('library-visit-seed', 4);
    const different = createBookArtworkDeck('another-library-visit', 4);

    expect(first).toEqual(repeated);
    expect(first).not.toEqual(different);
  });

  it('builds each spread from one rune page and one sigil page', () => {
    const deck = createBookArtworkDeck('full-grimoire');

    expect(deck).toHaveLength(BOOK_ARTWORK_SPREAD_COUNT);
    for (const spread of deck) {
      const pages = [spread.left, spread.right];
      const spellNames = pages.flatMap((page) => page.spells.map((spell) => spell.text));
      const runesPage = pages.find((page) => page.layout === 'runes');
      const sigilPage = pages.find((page) => page.layout === 'sigil');

      expect(pages.map((page) => page.layout).sort()).toEqual(['runes', 'sigil']);
      expect(new Set(spellNames).size).toBe(spellNames.length);
      expect(spellNames).toHaveLength(16);
      expect(runesPage?.spells).toHaveLength(8);
      expect(runesPage?.sigil).toBeNull();
      expect(sigilPage?.spells).toHaveLength(8);
      expect(sigilPage?.sigil).not.toBeNull();
      expect(sigilPage?.sigil).not.toHaveProperty('opacity');
      for (const page of pages) {
        for (const spell of page.spells) {
          expect(spell.x).toBeGreaterThan(32);
          expect(spell.x).toBeLessThan(BOOK_PAGE_TEXTURE_WIDTH - 32);
          expect(spell.y).toBeGreaterThan(60);
          expect(spell.y).toBeLessThan(BOOK_PAGE_TEXTURE_HEIGHT - 28);
          expect(spell.targetWidth).toBeGreaterThanOrEqual(BOOK_PAGE_WRITING_WIDTH * 0.5);
          expect(spell.targetWidth).toBeLessThanOrEqual(BOOK_PAGE_WRITING_WIDTH * 0.9);
          expect(spell).not.toHaveProperty('segments');
          expect(spell.text.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('avoids repeating spells on consecutive spreads', () => {
    const deck = createBookArtworkDeck('non-repeating-pages', 5);

    for (let index = 1; index < deck.length; index += 1) {
      const previous = new Set(
        [deck[index - 1].left, deck[index - 1].right].flatMap((page) =>
          page.spells.map((spell) => spell.text)
        )
      );
      const current = [deck[index].left, deck[index].right].flatMap((page) =>
        page.spells.map((spell) => spell.text)
      );

      expect(current.some((spell) => previous.has(spell))).toBe(false);
    }
  });
});
