// The paths of the application, for the build. Node reads this file. The browser does not.
// The site host serves files and has no fallback to index.html, so the build writes a copy of
// index.html at each path.
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {exampleList} from './examples/list.js';

const packagesDir = resolve(import.meta.dirname, '../packages');

export function sitePaths() {
  const packages = readdirSync(packagesDir, {withFileTypes: true}).filter(entry => entry.isDirectory()).map(entry => entry.name);
  return [
    'home',
    'bookings',
    'gallery',
    ...packages.map(name => `gallery/${name}`),
    'examples',
    ...exampleList.map(item => `examples/${item.id}`),
  ];
}
