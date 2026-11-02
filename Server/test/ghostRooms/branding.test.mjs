// CrossGhost branding in the H3 main menu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);

test('the Current Server tile shows the public host', async () => {
    const cwd = process.cwd();
    const origin = process.env.PUBLIC_ORIGIN;
    process.chdir(server);
    try {
        const { loadServerTile } = require('../../components/h3/menuData.js');
        delete process.env.PUBLIC_ORIGIN;
        let tile = await loadServerTile();
        assert.equal(tile.title, 'hitmanghost.ramon.cc');
        assert.deepEqual([tile.select.header, tile.select.title], ['Current Server', 'hitmanghost.ramon.cc']);
        process.env.PUBLIC_ORIGIN = 'https://ghost.example.org';
        tile = await loadServerTile();
        assert.equal(tile.title, 'ghost.example.org');
    } finally {
        process.chdir(cwd);
        if (origin === undefined) delete process.env.PUBLIC_ORIGIN; else process.env.PUBLIC_ORIGIN = origin;
    }
});

test('the repository tile links the CrossGhost server', async () => {
    const dashboard = await readFile(new URL('../../menudata/h3/menusystem/pages/hub/dashboard/dashboard.json', import.meta.url), 'utf8');
    assert.match(dashboard, /"title": "CrossGhost"/);
    assert.match(dashboard, /"url": "https:\/\/git\.ramon\.cc\/ramon\/crossghost-server"/);
    assert.match(dashboard, /crossghost_livetile\.png/);
    assert.doesNotMatch(dashboard, /localghost|gitlab/i);
});
