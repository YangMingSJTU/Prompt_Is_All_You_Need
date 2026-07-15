export const BOOK_PAGE_TEXTURE_WIDTH = 512;
export const BOOK_PAGE_TEXTURE_HEIGHT = 720;
export const BOOK_ARTWORK_SPREAD_COUNT = 8;
export const BOOK_PAGE_WRITING_WIDTH = 400;

const GRIMOIRE_GOLD = '#cfa85c';
const GRIMOIRE_GOLD_BRIGHT = '#f0d79b';
const GRIMOIRE_INK = '#e7dcc1';
const GRIMOIRE_MUTED = '#988da3';
const GRIMOIRE_SURFACE = '#232229';

export type BookPageSide = 'left' | 'right';
export type BookPageLayout = 'runes' | 'sigil';

export interface SpellPlacement {
  fontSize: number;
  maxWidth: number;
  role: 'featured' | 'entry';
  targetWidth: number;
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

type SpellSlot = Omit<SpellPlacement, 'targetWidth' | 'text'>;

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

const RUNES_PAGE_SLOTS: SpellSlot[] = Array.from({ length: 8 }, (_, index) => ({
  x: 92,
  y: 150 + index * 64,
  fontSize: index % 2 === 0 ? 20 : 19,
  maxWidth: 352,
  role: 'entry'
}));

const SIGIL_PAGE_SLOTS: SpellSlot[] = [
  { x: 256, y: 112, fontSize: 24, maxWidth: 344, role: 'featured' },
  ...Array.from({ length: 7 }, (_, index) => ({
    x: 88,
    y: 450 + index * 29,
    fontSize: 16,
    maxWidth: 356,
    role: 'entry' as const
  }))
];

const SPELLS_PER_SPREAD = RUNES_PAGE_SLOTS.length + SIGIL_PAGE_SLOTS.length;

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

function createSpellPlacement(
  slot: SpellSlot,
  baseSpell: string,
  random: () => number
): SpellPlacement {
  const widthRatio = 0.5 + random() * 0.4;
  return {
    ...slot,
    targetWidth: Math.min(slot.maxWidth, BOOK_PAGE_WRITING_WIDTH * widthRatio),
    text: baseSpell
  };
}

function createPageArtwork(
  side: BookPageSide,
  folio: number,
  layout: BookPageLayout,
  spellNames: string[],
  random: () => number
): BookPageArtwork {
  const slots = layout === 'runes' ? RUNES_PAGE_SLOTS : SIGIL_PAGE_SLOTS;
  return {
    folio,
    layout,
    seed: Math.floor(random() * 0xffffffff) >>> 0,
    side,
    sigil:
      layout === 'sigil'
        ? {
            radius: 104,
            rotation: random() * Math.PI * 2,
            variant: Math.floor(random() * 4),
            x: 256,
            y: 286
          }
        : null,
    spells: slots.map((slot, index) =>
      createSpellPlacement(slot, spellNames[index], random)
    )
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

    const sigilOnLeft = (spreadIndex + Math.floor(random() * 2)) % 2 === 0;
    const leftLayout: BookPageLayout = sigilOnLeft ? 'sigil' : 'runes';
    const rightLayout: BookPageLayout = sigilOnLeft ? 'runes' : 'sigil';
    const leftSpellCount =
      leftLayout === 'runes' ? RUNES_PAGE_SLOTS.length : SIGIL_PAGE_SLOTS.length;

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

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

export function traceBookIconPage(
  context: CanvasRenderingContext2D,
  side: BookPageSide
): void {
  const mirrorX = (x: number) =>
    side === 'left' ? x : BOOK_PAGE_TEXTURE_WIDTH - x;

  context.beginPath();
  context.moveTo(mirrorX(498), 142);
  context.bezierCurveTo(
    mirrorX(386),
    36,
    mirrorX(182),
    34,
    mirrorX(64),
    72
  );
  context.quadraticCurveTo(mirrorX(48), 78, mirrorX(44), 100);
  context.bezierCurveTo(
    mirrorX(38),
    262,
    mirrorX(28),
    486,
    mirrorX(34),
    616
  );
  context.quadraticCurveTo(mirrorX(34), 640, mirrorX(52), 646);
  context.bezierCurveTo(
    mirrorX(184),
    620,
    mirrorX(356),
    664,
    mirrorX(498),
    706
  );
  context.lineTo(mirrorX(498), 142);
  context.closePath();
}

function drawGraphicPage(
  context: CanvasRenderingContext2D,
  artwork: BookPageArtwork
): void {
  const width = BOOK_PAGE_TEXTURE_WIDTH;
  const height = BOOK_PAGE_TEXTURE_HEIGHT;
  context.clearRect(0, 0, width, height);

  traceBookIconPage(context, artwork.side);
  const surface = context.createLinearGradient(
    artwork.side === 'left' ? 0 : width,
    0,
    artwork.side === 'left' ? width : 0,
    0
  );
  surface.addColorStop(0, '#2d2a32');
  surface.addColorStop(0.7, GRIMOIRE_SURFACE);
  surface.addColorStop(1, '#15161a');
  context.fillStyle = surface;
  context.fill();
  context.strokeStyle = '#0b0c0f';
  context.lineWidth = 11;
  context.stroke();

  context.save();
  traceBookIconPage(context, artwork.side);
  context.shadowBlur = 8;
  context.shadowColor = 'rgba(207, 168, 92, 0.4)';
  context.strokeStyle = GRIMOIRE_GOLD;
  context.lineWidth = 4;
  context.stroke();
  context.shadowBlur = 0;
  context.strokeStyle = GRIMOIRE_GOLD_BRIGHT;
  context.lineWidth = 1.25;
  context.stroke();
  context.restore();

  traceBookIconPage(context, artwork.side);
  context.clip();

  const random = createRandom(artwork.seed ^ 0x67a9d31f);
  for (let index = 0; index < 3; index += 1) {
    const x = index % 2 === 0 ? 62 + random() * 18 : width - 80 + random() * 18;
    const y = 170 + random() * 360;
    const size = 2.5 + random() * 1.5;
    context.save();
    context.translate(x, y);
    context.rotate(Math.PI / 4);
    context.fillStyle = index % 2 === 0 ? GRIMOIRE_GOLD : GRIMOIRE_MUTED;
    context.fillRect(-size / 2, -size / 2, size, size);
    context.restore();
  }
}

function drawSpacedText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  spacing: number
): void {
  const characters = [...text];
  const widths = characters.map((character) => context.measureText(character).width);
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, characters.length - 1) * spacing;
  let cursor = centerX - totalWidth / 2;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  characters.forEach((character, index) => {
    context.fillText(character, cursor, y);
    cursor += widths[index] + spacing;
  });
}

function drawGlyphHeader(
  context: CanvasRenderingContext2D,
  artwork: BookPageArtwork
): void {
  context.save();
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(207, 168, 92, 0.58)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(74, 88);
  context.lineTo(154, 88);
  context.moveTo(358, 88);
  context.lineTo(438, 88);
  context.stroke();

  context.fillStyle = GRIMOIRE_GOLD;
  context.font = "600 11px Georgia, 'Times New Roman', serif";
  drawSpacedText(
    context,
    artwork.layout === 'runes' ? 'INCANTAMENTA' : 'SIGILLUM ARCANA',
    256,
    88,
    2.4
  );

  drawDiamond(context, 256, 109, 6, GRIMOIRE_MUTED);
  context.restore();
}

function fitSpellFont(
  context: CanvasRenderingContext2D,
  spell: SpellPlacement,
  minimumFontSize: number
): number {
  let fontSize = spell.fontSize;
  const targetWidth = Math.min(spell.targetWidth, spell.maxWidth);
  context.font = `italic 600 ${fontSize}px Georgia, 'Times New Roman', serif`;
  while (context.measureText(spell.text).width > targetWidth && fontSize > minimumFontSize) {
    fontSize -= 1;
    context.font = `italic 600 ${fontSize}px Georgia, 'Times New Roman', serif`;
  }
  return fontSize;
}

function drawDiamond(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  context.save();
  context.translate(x, y);
  context.rotate(Math.PI / 4);
  context.fillStyle = color;
  roundedRectPath(context, -size / 2, -size / 2, size, size, size * 0.2);
  context.fill();
  context.restore();
}

function drawArcaneRule(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  index: number,
  compact: boolean
): void {
  const endX = x + width;
  context.save();
  context.lineCap = 'round';
  context.strokeStyle = index % 2 === 0
    ? 'rgba(207, 168, 92, 0.42)'
    : 'rgba(152, 141, 163, 0.42)';
  context.lineWidth = compact ? 1 : 1.4;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(endX, y);
  context.stroke();

  const markerRatios = compact ? [0.44, 0.82] : [0.3, 0.63, 0.88];
  markerRatios.forEach((ratio, markerIndex) => {
    const markerX = x + width * ratio;
    if ((index + markerIndex) % 2 === 0) {
      drawDiamond(
        context,
        markerX,
        y,
        compact ? 3.5 : 4.5,
        markerIndex % 2 === 0 ? GRIMOIRE_GOLD : GRIMOIRE_MUTED
      );
      return;
    }
    context.fillStyle = markerIndex % 2 === 0 ? GRIMOIRE_GOLD : GRIMOIRE_MUTED;
    context.beginPath();
    context.arc(markerX, y, compact ? 1.5 : 2, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

function drawRuneEntry(
  context: CanvasRenderingContext2D,
  spell: SpellPlacement,
  index: number,
  compact = false
): void {
  const markerX = compact ? 67 : 66;
  const markerY = spell.y;
  const accentColor = index % 2 === 0 ? GRIMOIRE_MUTED : GRIMOIRE_GOLD;
  drawDiamond(context, markerX, markerY, compact ? 5 : 7, accentColor);

  const fontSize = fitSpellFont(context, spell, compact ? 11 : 13);
  context.fillStyle = GRIMOIRE_INK;
  context.font = `italic 600 ${fontSize}px Georgia, 'Times New Roman', serif`;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(spell.text, spell.x, markerY, spell.maxWidth);

  const ruleWidth = compact
    ? Math.min(292, spell.targetWidth * 0.86)
    : Math.min(332, spell.targetWidth * 0.92);
  drawArcaneRule(
    context,
    spell.x,
    markerY + (compact ? 11 : 18),
    ruleWidth,
    index,
    compact
  );
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

  context.strokeStyle = 'rgba(207, 168, 92, 0.12)';
  context.lineWidth = 18;
  context.beginPath();
  context.arc(0, 0, sigil.radius + 16, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = GRIMOIRE_GOLD;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(0, 0, sigil.radius, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = GRIMOIRE_MUTED;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, 0, sigil.radius * 0.72, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = 'rgba(240, 215, 155, 0.66)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(0, 0, sigil.radius * 0.88, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = GRIMOIRE_GOLD;
  context.lineWidth = 3;

  const starPoints = sigil.variant % 2 === 0 ? 5 : 7;
  strokeStar(
    context,
    sigil.radius * 0.55,
    starPoints,
    sigil.variant % 2 === 0 ? 2 : 3,
    -Math.PI / 2
  );

  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    drawDiamond(
      context,
      Math.cos(angle) * sigil.radius * 0.86,
      Math.sin(angle) * sigil.radius * 0.86,
      10,
      index % 2 === 0 ? GRIMOIRE_MUTED : GRIMOIRE_GOLD
    );
  }

  context.fillStyle = GRIMOIRE_GOLD;
  context.beginPath();
  context.arc(0, 0, 9, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = GRIMOIRE_GOLD_BRIGHT;
  context.lineWidth = 2;
  context.stroke();
  context.restore();
}

function drawFeaturedSpell(
  context: CanvasRenderingContext2D,
  spell: SpellPlacement
): void {
  const title = spell.text.toUpperCase();
  const fontSize = fitSpellFont(context, { ...spell, text: title }, 14);
  context.fillStyle = GRIMOIRE_GOLD_BRIGHT;
  context.font = `italic 700 ${fontSize}px Georgia, 'Times New Roman', serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(title, 256, 124, 318);

  context.strokeStyle = 'rgba(207, 168, 92, 0.68)';
  context.lineCap = 'round';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(106, 151);
  context.lineTo(224, 151);
  context.moveTo(288, 151);
  context.lineTo(406, 151);
  context.stroke();
  drawDiamond(context, 256, 151, 7, GRIMOIRE_MUTED);
}

function drawRunesPage(
  context: CanvasRenderingContext2D,
  artwork: BookPageArtwork
): void {
  artwork.spells.forEach((spell, index) => {
    drawRuneEntry(context, spell, index);
  });
}

function drawSigilPage(
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
  entries.forEach((spell, index) => {
    drawRuneEntry(context, spell, index, true);
  });
}

function drawPageFooter(
  context: CanvasRenderingContext2D,
  artwork: BookPageArtwork
): void {
  context.save();
  context.strokeStyle = 'rgba(207, 168, 92, 0.48)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(184, 650);
  context.lineTo(226, 650);
  context.moveTo(286, 650);
  context.lineTo(328, 650);
  context.stroke();
  drawDiamond(context, 256, 650, 5, GRIMOIRE_MUTED);
  context.fillStyle = GRIMOIRE_GOLD;
  context.font = "italic 600 11px Georgia, 'Times New Roman', serif";
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(artwork.folio).padStart(2, '0'), 256, 671);
  context.restore();
}

export function drawBookPageArtwork(
  context: CanvasRenderingContext2D,
  artwork: BookPageArtwork
): void {
  context.save();
  drawGraphicPage(context, artwork);
  drawGlyphHeader(context, artwork);
  if (artwork.layout === 'runes') {
    drawRunesPage(context, artwork);
  } else {
    drawSigilPage(context, artwork);
  }
  drawPageFooter(context, artwork);
  context.restore();
}
