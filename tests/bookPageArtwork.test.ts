import { describe, expect, it } from 'vitest';
import {
  BOOK_ARTWORK_SPREAD_COUNT,
  BOOK_PAGE_TEXTURE_HEIGHT,
  BOOK_PAGE_TEXTURE_WIDTH,
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

  it('builds each spread from one ordered text page and one diagram page', () => {
    const deck = createBookArtworkDeck('full-grimoire');

    expect(deck).toHaveLength(BOOK_ARTWORK_SPREAD_COUNT);
    for (const spread of deck) {
      const pages = [spread.left, spread.right];
      const spellNames = pages.flatMap((page) => page.spells.map((spell) => spell.text));
      const textPage = pages.find((page) => page.layout === 'text');
      const diagramPage = pages.find((page) => page.layout === 'diagram');

      expect(pages.map((page) => page.layout).sort()).toEqual(['diagram', 'text']);
      expect(new Set(spellNames).size).toBe(spellNames.length);
      expect(spellNames).toHaveLength(18);
      expect(textPage?.spells).toHaveLength(9);
      expect(textPage?.sigil).toBeNull();
      expect(diagramPage?.spells).toHaveLength(9);
      expect(diagramPage?.sigil).not.toBeNull();
      expect(diagramPage?.sigil).not.toHaveProperty('opacity');
      for (const page of pages) {
        for (const spell of page.spells) {
          expect(spell.x).toBeGreaterThan(32);
          expect(spell.x).toBeLessThan(BOOK_PAGE_TEXTURE_WIDTH - 32);
          expect(spell.y).toBeGreaterThan(60);
          expect(spell.y).toBeLessThan(BOOK_PAGE_TEXTURE_HEIGHT - 28);
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
