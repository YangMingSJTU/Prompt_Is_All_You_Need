export const BOOK_PAGE_TEXTURE_WIDTH = 512;
export const BOOK_PAGE_TEXTURE_HEIGHT = 720;
export const BOOK_ARTWORK_SPREAD_COUNT = 8;

export type BookPageSide = 'left' | 'right';
export type BookPageLayout = 'text' | 'diagram';

export interface SpellPlacement {
  fontSize: number;
  maxWidth: number;
  role: 'featured' | 'entry';
  text: string;
  x: number;
  y: number;
}

export interface SigilPlacement {
  radius: number;
  rotation: number;
  variant: number;
  x: number;
  y: number;
}

export interface BookPageArtwork {
  folio: number;
  layout: BookPageLayout;
  seed: number;
  side: BookPageSide;
  sigil: SigilPlacement | null;
  spells: SpellPlacement[];
}

export interface BookSpreadArtwork {
  left: BookPageArtwork;
  right: BookPageArtwork;
}

type SpellSlot = Omit<SpellPlacement, 'text'>;

const SPELL_POOL = [
  'Aberto',
  'Accio',
  'Aguamenti',
  'Alohomora',
  'Anapneo',
  'Arresto Momentum',
  'Ascendio',
  'Avis',
  'Bombarda',
  'Colloportus',
  'Confundo',
  'Confringo',
  'Defodio',
  'Deletrius',
  'Descendo',
  'Diffindo',
  'Engorgio',
  'Episkey',
  'Evanesco',
  'Expecto Patronum',
  'Expelliarmus',
  'Finite',
  'Glacius',
  'Homenum Revelio',
  'Impedimenta',
  'Incendio',
  'Legilimens',
  'Locomotor',
  'Lumos',
  'Meteolojinx Recanto',
  'Muffliato',
  'Nox',
  'Obliviate',
  'Orchideous',
  'Petrificus Totalus',
  'Protego',
  'Quietus',
  'Reducto',
  'Relashio',
  'Rennervate',
  'Reparo',
  'Revelio',
  'Riddikulus',
  'Scourgify',
  'Silencio',
  'Sonorus',
  'Specialis Revelio',
  'Stupefy',
  'Tarantallegra',
  'Waddiwasi',
  'Wingardium Leviosa'
];

const TEXT_PAGE_SLOTS: SpellSlot[] = [
  { x: 72, y: 112, fontSize: 23, maxWidth: 356, role: 'entry' },
  { x: 72, y: 178, fontSize: 22, maxWidth: 356, role: 'entry' },
  { x: 72, y: 244, fontSize: 23, maxWidth: 356, role: 'entry' },
  { x: 72, y: 310, fontSize: 22, maxWidth: 356, role: 'entry' },
  { x: 72, y: 376, fontSize: 23, maxWidth: 356, role: 'entry' },
  { x: 72, y: 442, fontSize: 22, maxWidth: 356, role: 'entry' },
  { x: 72, y: 508, fontSize: 23, maxWidth: 356, role: 'entry' },
  { x: 72, y: 574, fontSize: 22, maxWidth: 356, role: 'entry' },
  { x: 72, y: 640, fontSize: 23, maxWidth: 356, role: 'entry' }
];

const DIAGRAM_PAGE_SLOTS: SpellSlot[] = [
  { x: 256, y: 108, fontSize: 28, maxWidth: 372, role: 'featured' },
  { x: 66, y: 448, fontSize: 21, maxWidth: 166, role: 'entry' },
  { x: 282, y: 448, fontSize: 21, maxWidth: 166, role: 'entry' },
  { x: 66, y: 506, fontSize: 21, maxWidth: 166, role: 'entry' },
  { x: 282, y: 506, fontSize: 21, maxWidth: 166, role: 'entry' },
  { x: 66, y: 564, fontSize: 21, maxWidth: 166, role: 'entry' },
  { x: 282, y: 564, fontSize: 21, maxWidth: 166, role: 'entry' },
  { x: 66, y: 622, fontSize: 21, maxWidth: 166, role: 'entry' },
  { x: 282, y: 622, fontSize: 21, maxWidth: 166, role: 'entry' }
];

const SPELLS_PER_SPREAD = TEXT_PAGE_SLOTS.length + DIAGRAM_PAGE_SLOTS.length;

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function createPageArtwork(
  side: BookPageSide,
  folio: number,
  layout: BookPageLayout,
  spellNames: string[],
  random: () => number
): BookPageArtwork {
  const slots = layout === 'text' ? TEXT_PAGE_SLOTS : DIAGRAM_PAGE_SLOTS;
  return {
    folio,
    layout,
    seed: Math.floor(random() * 0xffffffff) >>> 0,
    side,
    sigil:
      layout === 'diagram'
        ? {
            radius: 112,
            rotation: random() * Math.PI * 2,
            variant: Math.floor(random() * 4),
            x: 256,
            y: 278
          }
        : null,
    spells: slots.map((slot, index) => ({ ...slot, text: spellNames[index] }))
  };
}

export function createBookArtworkDeck(
  seed: string,
  spreadCount = BOOK_ARTWORK_SPREAD_COUNT
): BookSpreadArtwork[] {
  const random = createRandom(hashSeed(seed));
  const spreads: BookSpreadArtwork[] = [];
  let previousSpellNames = new Set<string>();
  const safeSpreadCount = Math.max(1, Math.floor(spreadCount));

  for (let spreadIndex = 0; spreadIndex < safeSpreadCount; spreadIndex += 1) {
    const freshSpellNames = SPELL_POOL.filter((spell) => !previousSpellNames.has(spell));
    const spellSource =
      freshSpellNames.length >= SPELLS_PER_SPREAD ? freshSpellNames : SPELL_POOL;
    const spreadSpellNames = shuffled(spellSource, random).slice(0, SPELLS_PER_SPREAD);
    previousSpellNames = new Set(spreadSpellNames);

    const diagramOnLeft = (spreadIndex + Math.floor(random() * 2)) % 2 === 0;
    const leftLayout: BookPageLayout = diagramOnLeft ? 'diagram' : 'text';
    const rightLayout: BookPageLayout = diagramOnLeft ? 'text' : 'diagram';
    const leftSpellCount = leftLayout === 'text' ? TEXT_PAGE_SLOTS.length : DIAGRAM_PAGE_SLOTS.length;

    spreads.push({
      left: createPageArtwork(
        'left',
        spreadIndex * 2 + 1,
        leftLayout,
        spreadSpellNames.slice(0, leftSpellCount),
        random
      ),
      right: createPageArtwork(
        'right',
        spreadIndex * 2 + 2,
        rightLayout,
        spreadSpellNames.slice(leftSpellCount),
        random
      )
    });
  }

  return spreads;
}

function drawParchment(
  context: CanvasRenderingContext2D,
  artwork: BookPageArtwork
): void {
  const width = BOOK_PAGE_TEXTURE_WIDTH;
  const height = BOOK_PAGE_TEXTURE_HEIGHT;
  const spineOnRight = artwork.side === 'left';
  const background = context.createLinearGradient(0, 0, width, 0);
  if (spineOnRight) {
    background.addColorStop(0, '#f2e9d2');
    background.addColorStop(0.78, '#ead9b2');
    background.addColorStop(1, '#b99a67');
  } else {
    background.addColorStop(0, '#b99a67');
    background.addColorStop(0.22, '#ead9b2');
    background.addColorStop(1, '#f2e9d2');
  }
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const random = createRandom(artwork.seed);
  for (let index = 0; index < 58; index += 1) {
    const x = 24 + random() * (width - 48);
    const y = 24 + random() * (height - 48);
    const fiberWidth = 10 + random() * 38;
    context.fillStyle = `rgba(91, 58, 27, ${0.014 + random() * 0.024})`;
    context.fillRect(x, y, fiberWidth, 0.6 + random() * 0.7);
  }

  for (let index = 0; index < 3; index += 1) {
    const x = 70 + random() * (width - 140);
    const y = 84 + random() * (height - 168);
    const stain = context.createRadialGradient(x, y, 0, x, y, 30 + random() * 36);
    stain.addColorStop(0, 'rgba(128, 84, 35, 0.022)');
    stain.addColorStop(1, 'rgba(128, 84, 35, 0)');
    context.fillStyle = stain;
    context.fillRect(0, 0, width, height);
  }

  context.strokeStyle = 'rgba(91, 58, 27, 0.17)';
  context.lineWidth = 2;
  context.strokeRect(20, 18, width - 40, height - 36);
  context.strokeStyle = 'rgba(151, 105, 44, 0.1)';
  context.lineWidth = 1;
  context.strokeRect(28, 26, width - 56, height - 52);
}

function drawChapterHeader(
  context: CanvasRenderingContext2D,
  artwork: BookPageArtwork
): void {
  const title = artwork.layout === 'text' ? 'INCANTAMENTA' : 'SIGILLUM ARCANA';
  context.save();
  context.fillStyle = '#4a2b19';
  context.font = "700 14px 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(title, BOOK_PAGE_TEXTURE_WIDTH / 2, 59);

  context.strokeStyle = '#9a672f';
  context.fillStyle = '#8c5728';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(74, 78);
  context.lineTo(238, 78);
  context.moveTo(274, 78);
  context.lineTo(438, 78);
  context.stroke();
  context.beginPath();
  context.arc(256, 78, 3, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function fitSpellFont(
  context: CanvasRenderingContext2D,
  spell: SpellPlacement
): number {
  let fontSize = spell.fontSize;
  context.font = `italic 700 ${fontSize}px 'Palatino Linotype', 'Book Antiqua', Georgia, serif`;
  while (context.measureText(spell.text).width > spell.maxWidth && fontSize > 14) {
    fontSize -= 1;
    context.font = `italic 700 ${fontSize}px 'Palatino Linotype', 'Book Antiqua', Georgia, serif`;
  }
  return fontSize;
}

function drawEntryMarker(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  index: number
): void {
  context.save();
  context.strokeStyle = '#87511f';
  context.fillStyle = '#704019';
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(x, y, 6.5, 0, Math.PI * 2);
  context.stroke();
  context.font = "700 8px 'Palatino Linotype', Georgia, serif";
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(index + 1), x, y + 0.5);
  context.restore();
}

function drawAnnotationLine(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number
): void {
  context.save();
  context.strokeStyle = 'rgba(73, 42, 23, 0.42)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + width, y);
  context.stroke();
  context.restore();
}

function drawEntrySpell(
  context: CanvasRenderingContext2D,
  spell: SpellPlacement,
  index: number,
  random: () => number
): void {
  context.save();
  const fontSize = fitSpellFont(context, spell);
  context.fillStyle = '#392016';
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillText(spell.text, spell.x, spell.y);
  drawEntryMarker(context, spell.x - 28, spell.y - fontSize * 0.34, index);

  drawAnnotationLine(context, spell.x, spell.y + 17, 250 + random() * 92);

  context.strokeStyle = 'rgba(92, 53, 25, 0.24)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(48, spell.y + 42);
  context.lineTo(456, spell.y + 42);
  context.stroke();
  context.restore();
}

function drawDiagramEntry(
  context: CanvasRenderingContext2D,
  spell: SpellPlacement,
  random: () => number
): void {
  context.save();
  const fontSize = fitSpellFont(context, spell);
  context.fillStyle = '#392016';
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillText(spell.text, spell.x, spell.y);

  context.strokeStyle = '#7e4d1d';
  context.fillStyle = '#6f3d18';
  context.lineWidth = 1.1;
  context.beginPath();
  context.arc(spell.x - 18, spell.y - fontSize * 0.34, 5.5, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(spell.x - 18, spell.y - fontSize * 0.34, 1.7, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = 'rgba(73, 42, 23, 0.44)';
  context.beginPath();
  context.moveTo(spell.x, spell.y + 18);
  context.lineTo(spell.x + Math.min(spell.maxWidth, 116 + random() * 40), spell.y + 16);
  context.stroke();
  context.restore();
}

function drawFeaturedSpell(
  context: CanvasRenderingContext2D,
  spell: SpellPlacement
): void {
  context.save();
  const fontSize = fitSpellFont(context, spell);
  context.fillStyle = '#351d13';
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.fillText(spell.text, spell.x, spell.y);
  const width = Math.min(context.measureText(spell.text).width + 48, 310);
  context.strokeStyle = '#8a5524';
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(spell.x - width / 2, spell.y + fontSize * 0.55);
  context.lineTo(spell.x - 13, spell.y + fontSize * 0.55);
  context.moveTo(spell.x + 13, spell.y + fontSize * 0.55);
  context.lineTo(spell.x + width / 2, spell.y + fontSize * 0.55);
  context.stroke();
  context.fillStyle = '#7f491f';
  context.beginPath();
  context.arc(spell.x, spell.y + fontSize * 0.55, 2.6, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function strokePolygon(
  context: CanvasRenderingContext2D,
  radius: number,
  points: number,
  rotation: number
): void {
  context.beginPath();
  for (let index = 0; index <= points; index += 1) {
    const pointIndex = index === points ? 0 : index;
    const angle = rotation + (pointIndex / points) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
}

function strokeStar(
  context: CanvasRenderingContext2D,
  radius: number,
  points: number,
  step: number,
  rotation: number
): void {
  context.beginPath();
  let pointIndex = 0;
  for (let index = 0; index <= points; index += 1) {
    const angle = rotation + (pointIndex / points) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
    pointIndex = (pointIndex + step) % points;
  }
  context.stroke();
}

function drawSigil(context: CanvasRenderingContext2D, sigil: SigilPlacement): void {
  context.save();
  context.translate(sigil.x, sigil.y);
  context.rotate(sigil.rotation);
  context.strokeStyle = '#663613';
  context.fillStyle = '#663613';
  context.lineWidth = 2.4;

  context.beginPath();
  context.arc(0, 0, sigil.radius, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(0, 0, sigil.radius * 0.84, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(0, 0, sigil.radius * 0.3, 0, Math.PI * 2);
  context.stroke();

  if (sigil.variant === 0) {
    strokeStar(context, sigil.radius * 0.68, 5, 2, -Math.PI / 2);
  } else if (sigil.variant === 1) {
    strokePolygon(context, sigil.radius * 0.66, 3, -Math.PI / 2);
    strokePolygon(context, sigil.radius * 0.66, 3, Math.PI / 2);
  } else if (sigil.variant === 2) {
    strokePolygon(context, sigil.radius * 0.64, 4, Math.PI / 4);
    strokePolygon(context, sigil.radius * 0.43, 4, 0);
  } else {
    strokeStar(context, sigil.radius * 0.68, 7, 3, -Math.PI / 2);
  }

  const tickCount = 16;
  for (let index = 0; index < tickCount; index += 1) {
    const angle = (index / tickCount) * Math.PI * 2;
    const inner = sigil.radius * (index % 4 === 0 ? 0.72 : 0.78);
    const outer = sigil.radius * 0.94;
    context.beginPath();
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    context.stroke();
  }

  context.beginPath();
  context.arc(0, 0, 4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawTextPage(
  context: CanvasRenderingContext2D,
  artwork: BookPageArtwork
): void {
  const random = createRandom(artwork.seed ^ 0x517cc1b7);
  artwork.spells.forEach((spell, index) => {
    drawEntrySpell(context, spell, index, random);
  });
}

function drawDiagramPage(
  context: CanvasRenderingContext2D,
  artwork: BookPageArtwork
): void {
  const [featured, ...entries] = artwork.spells;
  if (featured) {
    drawFeaturedSpell(context, featured);
  }
  if (artwork.sigil) {
    drawSigil(context, artwork.sigil);
  }

  const random = createRandom(artwork.seed ^ 0x8f4d13a9);
  entries.forEach((spell) => {
    drawDiagramEntry(context, spell, random);
  });
}

function drawFolio(
  context: CanvasRenderingContext2D,
  artwork: BookPageArtwork
): void {
  context.save();
  context.fillStyle = 'rgba(91, 58, 27, 0.5)';
  context.font = "600 14px 'Palatino Linotype', Georgia, serif";
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(artwork.folio).padStart(2, '0'), BOOK_PAGE_TEXTURE_WIDTH / 2, 684);
  context.restore();
}

export function drawBookPageArtwork(
  context: CanvasRenderingContext2D,
  artwork: BookPageArtwork
): void {
  drawParchment(context, artwork);
  drawChapterHeader(context, artwork);
  if (artwork.layout === 'text') {
    drawTextPage(context, artwork);
  } else {
    drawDiagramPage(context, artwork);
  }
  drawFolio(context, artwork);
}
