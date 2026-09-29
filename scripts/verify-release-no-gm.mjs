import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
const forbidden = /__toyhouse_debug|toyhouse-local-gm|local-gm|gm-panel|GM_LOCAL_ONLY/;
export async function verifyRelease(directory) {
const root = resolve(directory);
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (forbidden.test(entry.name)) throw new Error(`Local development file in release: ${relative(root, path)}`);
    if (entry.isDirectory()) await scan(path);
    else if (['.js', '.html', '.css', '.json'].includes(extname(path)) && forbidden.test(await readFile(path, 'utf8'))) {
      throw new Error(`Development control surface in release: ${relative(root, path)}`);
    }
  }
}
await scan(root);
console.log(`Release GM exclusion verified: ${root}`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await verifyRelease(process.argv[2] || 'docs');
