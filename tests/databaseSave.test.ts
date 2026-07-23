import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  type DatabaseFileOperations
} from '../desktop/main/services/database';

describe('database transaction queue', () => {
  it('serializes mutation and persistence in transaction call order', async () => {
    const writes: Uint8Array[] = [];
    const firstWriteStarted = deferred();
    const releaseFirstWrite = deferred();
    let replaceCalls = 0;
    const db = await createTestDatabase({
      filePath: 'virtual/index.sqlite',
      fileOperations: createVirtualOperations({
        async write(bytes) {
          writes.push(new Uint8Array(bytes));
          if (writes.length === 1) {
            firstWriteStarted.resolve();
            await releaseFirstWrite.promise;
          }
        },
        replace() {
          replaceCalls += 1;
        }
      })
    });

    const firstTransaction = db.transaction(() => {
      db.run(
        "INSERT INTO app_settings (key, value, updated_at) VALUES ('save-order', 'first', 'now')"
      );
    });
    await firstWriteStarted.promise;

    let secondMutationStarted = false;
    const secondTransaction = db.transaction(() => {
      secondMutationStarted = true;
      db.run("UPDATE app_settings SET value = 'second' WHERE key = 'save-order'");
    });
    await Promise.resolve();

    expect(secondMutationStarted).toBe(false);
    expect(writes).toHaveLength(1);
    releaseFirstWrite.resolve();
    await Promise.all([firstTransaction, secondTransaction]);

    expect(secondMutationStarted).toBe(true);
    expect(writes).toHaveLength(2);
    expect(replaceCalls).toBe(2);
    expect(db.get('SELECT value FROM app_settings WHERE key = ?', ['save-order'])).toEqual({
      value: 'second'
    });
  });

  it('rolls back a failed persistence and continues with the next queued transaction', async () => {
    const writeFailure = new Error('simulated write failure');
    const recoveredWrites: Uint8Array[] = [];
    let writeCalls = 0;
    const db = await createTestDatabase({
      filePath: 'virtual/index.sqlite',
      fileOperations: createVirtualOperations({
        write(bytes) {
          writeCalls += 1;
          if (writeCalls === 1) {
            throw writeFailure;
          }
          recoveredWrites.push(new Uint8Array(bytes));
        }
      })
    });

    const failedTransaction = db.transaction(() => {
      db.run(
        "INSERT INTO app_settings (key, value, updated_at) VALUES ('save-recovery', 'failed', 'now')"
      );
    });
    const observedFailure = failedTransaction.catch((error: unknown) => error);
    const recoveredTransaction = db.transaction(() => {
      db.run(
        "INSERT INTO app_settings (key, value, updated_at) VALUES ('save-recovery', 'recovered', 'now')"
      );
    });

    expect(await observedFailure).toBe(writeFailure);
    await expect(recoveredTransaction).resolves.toBeUndefined();
    expect(writeCalls).toBe(2);
    expect(recoveredWrites).toHaveLength(1);
    expect(db.get('SELECT value FROM app_settings WHERE key = ?', ['save-recovery'])).toEqual({
      value: 'recovered'
    });
  });
});

function createVirtualOperations(hooks: {
  write(bytes: Uint8Array): void | Promise<void>;
  replace?(): void | Promise<void>;
}): DatabaseFileOperations {
  return {
    async read() {
      const error = new Error('not found') as Error & { code: string };
      error.code = 'ENOENT';
      throw error;
    },
    async makeDirectory() {},
    async write(_path, bytes) {
      await hooks.write(bytes);
    },
    async replace() {
      await hooks.replace?.();
    },
    async remove() {}
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
