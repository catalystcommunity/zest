import { describe, it, expect } from 'vitest';
import {existsSync, readdirSync, readFileSync, writeFileSync, rmSync} from 'fs';
import {resolve} from 'path';
import {spawnSync} from 'child_process';

// Each package publishes TypeScript declarations. This checks that each runtime export has a
// declaration, and that the declarations and the examples in types/ pass a strict tsc.

const root = resolve(import.meta.dirname, '..');
const packageDirs = readdirSync(resolve(root, 'packages'));
const manifests = [
    {dir: root, manifest: JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))},
    ...packageDirs.map(dir => ({dir: resolve(root, 'packages', dir), manifest: JSON.parse(readFileSync(resolve(root, 'packages', dir, 'package.json'), 'utf8'))})),
];
const generated = resolve(root, 'types/exports.generated.ts');

describe('type declarations', () => {
    it('are named in each package.json, exist, and are published', () => {
        for (const {dir, manifest} of manifests) {
            expect(manifest.types, manifest.name).toBeTruthy();
            expect(existsSync(resolve(dir, manifest.types)), `${manifest.name}: ${manifest.types}`).toBe(true);
            const published = (manifest.files ?? []).some(entry => manifest.types === entry || manifest.types.startsWith(`${entry.replace(/\/$/, '')}/`));
            expect(published, `${manifest.name}: ${manifest.types} is in files`).toBe(true);
        }
    });

    it('declare each runtime export, and pass a strict tsc', async () => {
        const lines = ['// Made by __tests__/types.spec.js. Each runtime export, imported through its declarations.'];
        for (const {dir, manifest} of manifests) {
            // The umbrella is not in node_modules, so it is imported by path
            const specifier = dir === root ? '../src/index.js' : manifest.name;
            const runtime = await import(dir === root ? resolve(root, manifest.main) : manifest.name);
            const names = Object.keys(runtime).filter(name => name !== 'default');
            const alias = manifest.name.replace(/\W/g, '_');
            if ('default' in runtime) { lines.push(`import ${alias}_default from '${specifier}';`, `void ${alias}_default;`); }
            if (names.length) {
                lines.push(`import { ${names.map(name => `${name} as ${alias}_${name}`).join(', ')} } from '${specifier}';`);
                lines.push(`void [${names.map(name => `${alias}_${name}`).join(', ')}];`);
            }
        }
        writeFileSync(generated, `${lines.join('\n')}\n`);
        try {
            const result = spawnSync(resolve(root, 'node_modules/.bin/tsc'), ['-p', resolve(root, 'types/tsconfig.json')], {encoding: 'utf8'});
            expect(`${result.stdout}${result.stderr}`.trim()).toBe('');
            expect(result.status).toBe(0);
        } finally {
            rmSync(generated, {force: true});
        }
    }, 60_000);
});
