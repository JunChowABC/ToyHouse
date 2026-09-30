import { mkdir, cp } from 'node:fs/promises';
import { verifyRelease } from './verify-release-no-gm.mjs';
const target = 'output/full-publish/pages';
await mkdir(`${target}/assets`, { recursive: true });
for (const file of ['index.html', 'game.js', 'styles.css']) await cp(`docs/${file}`, `${target}/${file}`);
for (const directory of ['runtime-ui', 'loading-v1', 'tool-dialog-v1', 'mechanics-v1']) await cp(`docs/assets/${directory}`, `${target}/assets/${directory}`, { recursive: true });
await verifyRelease('docs');
await verifyRelease(target);
console.log(`Prepared actual Pages runtime artifact: ${target}`);
