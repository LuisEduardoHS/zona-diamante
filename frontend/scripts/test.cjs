const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// checks/ is versioned; tests/ also contains inherited, ignored local checks.
// Do not pass a missing glob to Node on a clean checkout.
const root = path.resolve(__dirname, '..');
const files = ['checks', 'tests'].flatMap(dir => {
  const folder = path.join(root, dir);
  return fs.existsSync(folder) ? fs.readdirSync(folder).filter(file => file.endsWith('.test.mjs'))
    .sort().map(file => path.join(folder, file)) : [];
});
if (!files.length) throw new Error('No frontend tests found');
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
