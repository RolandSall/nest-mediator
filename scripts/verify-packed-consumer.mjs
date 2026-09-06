import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageDirectory = resolve(fileURLToPath(new URL('..', import.meta.url)));
const suppliedTarball = process.argv[2];
let tarball;
let createdTarball = false;

if (suppliedTarball) {
  tarball = resolve(suppliedTarball);
} else {
  const pack = spawnSync('npm', ['pack', '--ignore-scripts', '--json'], {
    cwd: packageDirectory,
    encoding: 'utf8',
  });
  assert.equal(pack.status, 0, pack.stderr || pack.stdout);
  const [{ filename }] = JSON.parse(pack.stdout);
  tarball = join(packageDirectory, filename);
  createdTarball = true;
}

const consumerDirectory = await mkdtemp(join(tmpdir(), 'nest-mediator-consumer-'));
try {
  await writeFile(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({ private: true }, null, 2),
  );

  const install = spawnSync(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      tarball,
      '@nestjs/common@10.4.20',
      '@nestjs/core@10.4.20',
      'reflect-metadata@0.2.2',
      'rxjs@7.8.2',
    ],
    { cwd: consumerDirectory, encoding: 'utf8' },
  );
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const smokeTest = `
require('reflect-metadata');
const mediator = require('@nest-mediator/core');
if (typeof mediator.NestMediatorModule?.forRoot !== 'function') {
  throw new Error('NestMediatorModule.forRoot is not available');
}
if (typeof mediator.MediatorBus !== 'function') {
  throw new Error('MediatorBus is not available');
}
console.log('consumer smoke test passed');
`;
  await writeFile(join(consumerDirectory, 'smoke.cjs'), smokeTest);

  const smoke = spawnSync(process.execPath, ['smoke.cjs'], {
    cwd: consumerDirectory,
    encoding: 'utf8',
  });
  assert.equal(smoke.status, 0, smoke.stderr || smoke.stdout);

  const installedPackages = await readdir(join(consumerDirectory, 'node_modules'));
  assert.equal(
    installedPackages.includes('@integration-testing'),
    false,
    '@integration-testing/testcontainers leaked into the consumer install',
  );

  console.log(
    `Verified ${basename(tarball)} on Node ${process.version} without test-only dependencies`,
  );
} finally {
  await rm(consumerDirectory, { recursive: true, force: true });
  if (createdTarball) {
    await unlink(tarball);
  }
}
