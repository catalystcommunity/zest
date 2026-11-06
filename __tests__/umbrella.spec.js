import { describe, it, expect } from 'vitest';
import {readdirSync, readFileSync} from 'fs';
import {resolve} from 'path';
import * as zest from '../src/index.js';

const root = resolve(import.meta.dirname, '..');
const rootPackage = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const packageDirs = readdirSync(resolve(root, 'packages'));
const packages = packageDirs.map(dir => JSON.parse(readFileSync(resolve(root, 'packages', dir, 'package.json'), 'utf8')));

describe('the umbrella package', () => {
    it('has an entry point that exists and is published', () => {
        expect(rootPackage.main).toEqual('src/index.js');
        expect(rootPackage.files).toContain('src/index.js');
    });

    it('exports something from each package, with no undefined exports', () => {
        expect(Object.keys(zest).length).toBeGreaterThan(packages.length);
        for (const [name, value] of Object.entries(zest)) {
            expect(value, name).toBeDefined();
        }
    });

    it('defines no elements when it is imported', () => {
        expect(customElements.get('menu-item')).toBeUndefined();
        expect(customElements.get('two-tier-menu')).toBeUndefined();
    });

    it('loses no name of a package that it exports with export *', async () => {
        const source = readFileSync(resolve(root, 'src/index.js'), 'utf8');
        const starred = [...source.matchAll(/export \* from '(@catalystcommunity\/[^']+)'/g)].map(match => match[1]);
        const seen = new Map();
        for (const name of starred) {
            const dir = name.split('/')[1];
            for (const exported of Object.keys(await import(`../packages/${dir}/src/index.js`))) {
                expect(seen.get(exported), `${exported} is in ${seen.get(exported)} and ${name}`).toBeUndefined();
                seen.set(exported, name);
                expect(zest[exported], exported).toBeDefined();
            }
        }
    });

    it('imports and depends on each package', () => {
        const source = readFileSync(resolve(root, 'src/index.js'), 'utf8');
        for (const pkg of packages) {
            expect(source, pkg.name).toContain(`'${pkg.name}'`);
            expect(rootPackage.dependencies, pkg.name).toHaveProperty(pkg.name);
        }
    });
});

describe('each package', () => {
    it.each(packages.map(pkg => [pkg.name, pkg]))('%s declares each package that it imports', (name, pkg) => {
        const dir = name.split('/')[1];
        // Each file of the published source, because index.js can export from other files
        const source = readdirSync(resolve(root, 'packages', dir, 'src'), {recursive: true})
            .filter(file => String(file).endsWith('.js'))
            .map(file => readFileSync(resolve(root, 'packages', dir, 'src', String(file)), 'utf8'))
            .join('\n');
        const imported = [...source.matchAll(/from\s+["'](@catalystcommunity\/[^"']+)["']/g)].map(match => match[1]);
        for (const dependency of imported) {
            expect(pkg.dependencies, dependency).toHaveProperty(dependency);
        }
        expect(Object.keys(pkg.dependencies || {}).sort()).toEqual([...new Set(imported)].sort());
    });

    it.each(packages.map(pkg => [pkg.name, pkg]))('%s accepts the version of each sibling in this repository', (name, pkg) => {
        for (const [dependency, range] of Object.entries(pkg.dependencies || {})) {
            const sibling = packages.find(other => other.name === dependency);
            expect(sibling, dependency).toBeDefined();
            const [, low] = />=(\d+\.\d+\.\d+)/.exec(range);
            const compare = low.split('.').map(Number).map((part, i) => Math.sign(sibling.version.split('.').map(Number)[i] - part));
            expect(compare.find(part => part !== 0) ?? 0, `${dependency} ${sibling.version} is below ${range}`).toBeGreaterThanOrEqual(0);
        }
    });
});
