import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../desktop/main/services/database';

describe('database save queue', () => {
  it('writes deferred snapshots in save call order', async () => {
    const writes: Uint8Array[] = [];
    const firstWriteStarted = deferred();
    const releaseFirstWrite = deferred();
    const db = await createTestDatabase({
      filePath: 'virtual/index.sqlite',
      writeOperations: {
        async createParentDirectory() {
          return undefined;
        },
        async writeFile(_filePath, bytes) {
          writes.push(new Uint8Array(bytes));
          if (writes.length === 1) {
            firstWriteStarted.resolve();
            await releaseFirstWrite.promise;
          }
        }
      }
    });

    db.run(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('save-order', 'first', 'now')"
    );
    const expectedFirst = db.exportBytes();
    const firstSave = db.save();
    await firstWriteStarted.promise;

    db.run("UPDATE app_settings SET value = 'second' WHERE key = 'save-order'");
    const expectedSecond = db.exportBytes();
    const secondSave = db.save();
    await Promise.resolve();

    expect(writes).toHaveLength(1);

    releaseFirstWrite.resolve();
    await Promise.all([firstSave, secondSave]);

    expect(writes).toHaveLength(2);
    expect(Array.from(writes[0])).toEqual(Array.from(expectedFirst));
    expect(Array.from(writes[1])).toEqual(Array.from(expectedSecond));
  });

  it('rejects the failed save but continues with the next queued snapshot', async () => {
    const writeFailure = new Error('simulated write failure');
    const recoveredWrites: Uint8Array[] = [];
    let writeCalls = 0;
    const db = await createTestDatabase({
      filePath: 'virtual/index.sqlite',
      writeOperations: {
        async createParentDirectory() {
          return undefined;
        },
        async writeFile(_filePath, bytes) {
          writeCalls += 1;
          if (writeCalls === 1) {
            throw writeFailure;
          }
          recoveredWrites.push(new Uint8Array(bytes));
        }
      }
    });

    db.run(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('save-recovery', 'failed', 'now')"
    );
    const failedSave = db.save();
    const observedFailure = failedSave.catch((error: unknown) => error);

    db.run("UPDATE app_settings SET value = 'recovered' WHERE key = 'save-recovery'");
    const expectedRecovery = db.exportBytes();
    const recoveredSave = db.save();

    expect(await observedFailure).toBe(writeFailure);
    await expect(recoveredSave).resolves.toBeUndefined();
    expect(writeCalls).toBe(2);
    expect(recoveredWrites).toHaveLength(1);
    expect(Array.from(recoveredWrites[0])).toEqual(Array.from(expectedRecovery));
  });
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
