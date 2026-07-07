import { existsSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { getAppIconPath } from '../desktop/main/services/appAssets';

describe('app assets', () => {
  it('uses a Windows icon file for window and taskbar chrome', () => {
    const iconPath = getAppIconPath(process.cwd(), 'win32');

    expect(normalize(iconPath)).toBe(normalize(join(process.cwd(), 'assets', 'icons', 'app-icon.ico')));
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
  expect(x).toBeLessThan(width);
  expect(y).toBeLessThan(height);

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  expect(channels).toBeGreaterThan(0);

  const stride = width * channels;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  let readOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filter = inflated[readOffset];
    readOffset += 1;
    const row = Buffer.from(inflated.subarray(readOffset, readOffset + stride));
    readOffset += stride;
    unfilterRow(row, previous, channels, filter);

    if (rowIndex === y) {
      const pixelOffset = x * channels;
      return {
        r: row[pixelOffset],
        g: row[pixelOffset + 1],
        b: row[pixelOffset + 2],
        a: channels === 4 ? row[pixelOffset + 3] : 255
      };
    }
    previous = row;
  }

  throw new Error('PNG pixel is outside image bounds');
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
