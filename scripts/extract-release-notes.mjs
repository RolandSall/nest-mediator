import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const requestedVersion = process.argv[2] ?? packageJson.version;
const version = requestedVersion.replace(/^v/, '');

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid release version: ${requestedVersion}`);
}

const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const headingPrefix = `## ${version} - `;
const sectionStart = changelog.indexOf(headingPrefix);

if (sectionStart === -1) {
  throw new Error(`CHANGELOG.md has no release section for ${version}`);
}

const nextSection = changelog.indexOf('\n## ', sectionStart + headingPrefix.length);
const releaseNotes = changelog
  .slice(sectionStart, nextSection === -1 ? changelog.length : nextSection)
  .trim();

process.stdout.write(`${releaseNotes}\n`);
