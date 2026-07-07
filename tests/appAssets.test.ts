import { existsSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { getAppIconPath, getTrayIconPath } from '../desktop/main/services/appAssets';

describe('app assets', () => {
  it('uses a Windows icon file for window and taskbar chrome', () => {
    const iconPath = getAppIconPath(process.cwd(), 'win32');

    expect(normalize(iconPath)).toBe(normalize(join(process.cwd(), 'assets', 'icons', 'app-icon.ico')));
    expect(iconPath).not.toContain('docs');
    expect(existsSync(iconPath)).toBe(true);
  });

  it('uses a separate transparent icon for the tray', () => {
    const iconPath = getTrayIconPath(process.cwd());

    expect(normalize(iconPath)).toBe(normalize(join(process.cwd(), 'assets', 'icons', 'tray-icon.png')));
    expect(iconPath).not.toContain('docs');
    expect(existsSync(iconPath)).toBe(true);
  });

  it('keeps the runtime png icon transparent for tray scaling', () => {
    const pngPath = join(process.cwd(), 'assets', 'icons', 'app-icon.png');
    const png = readPngHeader(pngPath);
    const corner = readPngPixel(pngPath, 0, 0);

    expect(png.colorType).toBe(6);
    expect(corner.a).toBe(0);
  });

  it('renders a full app tile with enough taskbar visual weight', () => {
    const pngPath = join(process.cwd(), 'assets', 'icons', 'app-icon.png');
    const center = readPngPixel(pngPath, 512, 512);
    const tileSamples = [
      readPngPixel(pngPath, 64, 512),
      readPngPixel(pngPath, 960, 512),
      readPngPixel(pngPath, 512, 64),
      readPngPixel(pngPath, 512, 960)
    ];

    expect(center.a).toBeGreaterThanOrEqual(230);

    for (const sample of tileSamples) {
      expect(sample.a).toBeGreaterThanOrEqual(230);
      expect(sample.r).toBeGreaterThanOrEqual(18);
      expect(sample.r).toBeLessThanOrEqual(58);
      expect(sample.g).toBeGreaterThanOrEqual(18);
      expect(sample.g).toBeLessThanOrEqual(52);
      expect(sample.b).toBeGreaterThanOrEqual(20);
      expect(sample.b).toBeLessThanOrEqual(48);
    }
  });

  it('keeps the golden book mark large enough for taskbar scale', () => {
    const pngPath = join(process.cwd(), 'assets', 'icons', 'app-icon.png');
    const bounds = readPngBounds(pngPath, (pixel) => pixel.a > 80 && pixel.r > 150 && pixel.g > 110 && pixel.b < 95);

    expect(bounds.widthRatio).toBeGreaterThanOrEqual(0.72);
    expect(bounds.heightRatio).toBeGreaterThanOrEqual(0.68);
  });
});

function readPngHeader(path: string): { width: number; height: number; colorType: number } {
  const bytes = Buffer.from(readFileSync(path));
  const signature = bytes.subarray(0, 8).toString('hex');
  expect(signature).toBe('89504e470d0a1a0a');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25]
  };
}

function readPngPixel(path: string, x: number, y: number): { r: number; g: number; b: number; a: number } {
  const png = readPngPixels(path);
  expect(x).toBeLessThan(png.width);
  expect(y).toBeLessThan(png.height);
  return png.getPixel(x, y);
}

function readPngBounds(
  path: string,
  predicate: (pixel: { r: number; g: number; b: number; a: number }) => boolean
): { widthRatio: number; heightRatio: number } {
  const png = readPngPixels(path);
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (predicate(png.getPixel(x, y))) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  expect(maxX).toBeGreaterThanOrEqual(0);
  return {
    widthRatio: (maxX - minX + 1) / png.width,
    heightRatio: (maxY - minY + 1) / png.height
  };
}

function readPngPixels(path: string): {
  width: number;
  height: number;
  getPixel(x: number, y: number): { r: number; g: number; b: number; a: number };
} {
  const bytes = Buffer.from(readFileSync(path));
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === 'IHDR') {
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
    }
    if (type === 'IDAT') {
      idatChunks.push(bytes.subarray(dataStart, dataEnd));
    }
    offset = dataEnd + 4;
  }

  expect(bitDepth).toBe(8);

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  expect(channels).toBeGreaterThan(0);

  const stride = width * channels;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  let readOffset = 0;
  let previous = Buffer.alloc(stride);

  const rows: Buffer[] = [];
  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filter = inflated[readOffset];
    readOffset += 1;
    const row = Buffer.from(inflated.subarray(readOffset, readOffset + stride));
    readOffset += stride;
    unfilterRow(row, previous, channels, filter);
    rows.push(row);
    previous = row;
  }

  return {
    width,
    height,
    getPixel(x: number, y: number) {
      const row = rows[y];
      const pixelOffset = x * channels;
      return {
        r: row[pixelOffset],
        g: row[pixelOffset + 1],
        b: row[pixelOffset + 2],
        a: channels === 4 ? row[pixelOffset + 3] : 255
      };
    }
  };
}

function unfilterRow(row: Buffer, previous: Buffer, channels: number, filter: number): void {
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= channels ? row[index - channels] : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= channels ? previous[index - channels] ?? 0 : 0;
    let prediction = 0;
    if (filter === 1) {
      prediction = left;
    } else if (filter === 2) {
      prediction = up;
    } else if (filter === 3) {
      prediction = Math.floor((left + up) / 2);
    } else if (filter === 4) {
      prediction = paeth(left, up, upLeft);
    }
    row[index] = (row[index] + prediction) & 0xff;
  }
}

function paeth(left: number, up: number, upLeft: number): number {
  const prediction = left + up - upLeft;
  const leftDistance = Math.abs(prediction - left);
  const upDistance = Math.abs(prediction - up);
  const upLeftDistance = Math.abs(prediction - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  return upDistance <= upLeftDistance ? up : upLeft;
}
