import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const requestedPlatform = process.argv[process.argv.indexOf('--platform') + 1];
if (requestedPlatform !== 'win32' && requestedPlatform !== 'darwin') {
  throw new Error('Usage: node scripts/packaged-smoke.mjs --platform win32|darwin');
}
if (process.platform !== requestedPlatform) {
  throw new Error(
    `Packaged smoke for ${requestedPlatform} must run natively; current host is ${process.platform}`
  );
}

const repositoryRoot = process.cwd();
const outputDirectory = join(repositoryRoot, 'packaged-output');
const evidencePath = join(outputDirectory, `smoke-evidence-${requestedPlatform}.json`);
const profilePath = join(outputDirectory, `smoke-profile-${requestedPlatform}`);
const executablePath = await findExecutable(outputDirectory, requestedPlatform);

await rm(evidencePath, { force: true });
await rm(profilePath, { recursive: true, force: true });
await mkdir(profilePath, { recursive: true });

const exitCode = await runWithTimeout(
  executablePath,
  [`--user-data-dir=${profilePath}`],
  {
    ...process.env,
    SPELLBOOK_PACKAGED_SMOKE_EVIDENCE: evidencePath
  },
  90_000
);
if (exitCode !== 0) {
  throw new Error(`Packaged application exited with code ${exitCode}`);
}

const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
if (
  evidence.platform !== requestedPlatform ||
  evidence.isPackaged !== true ||
  evidence.passed !== true
) {
  throw new Error(`Packaged smoke failed: ${JSON.stringify(evidence, null, 2)}`);
}

console.log(JSON.stringify({ executablePath, evidencePath, evidence }, null, 2));

async function findExecutable(outputRoot, platform) {
  const candidates = platform === 'win32'
    ? [join(outputRoot, 'win-unpacked', 'Spellbook.exe')]
    : [
        join(outputRoot, 'mac', 'Spellbook.app', 'Contents', 'MacOS', 'Spellbook'),
        join(outputRoot, 'mac-arm64', 'Spellbook.app', 'Contents', 'MacOS', 'Spellbook'),
        join(outputRoot, 'mac-x64', 'Spellbook.app', 'Contents', 'MacOS', 'Spellbook')
      ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return resolve(candidate);
    } catch {
      // Try the next electron-builder native output directory.
    }
  }
  throw new Error(`Packaged executable was not found. Checked: ${candidates.join(', ')}`);
}

function runWithTimeout(command, args, env, timeoutMs) {
  return new Promise((resolveExit, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit',
      windowsHide: true
    });
    let completed = false;
    const timer = setTimeout(() => {
      if (!completed) {
        child.kill();
        reject(new Error(`Packaged application did not exit within ${timeoutMs} ms`));
      }
    }, timeoutMs);
    child.once('error', (error) => {
      completed = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      completed = true;
      clearTimeout(timer);
      if (signal) {
        reject(new Error(`Packaged application exited from signal ${signal}`));
        return;
      }
      resolveExit(code ?? 1);
    });
  });
}
