const fs = require('node:fs');
const path = require('node:path');

// Share only the icons in use, rather than shipping Lucide's full catalog.
const names = [
    'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up-right', 'at-sign', 'badge-check',
    'calendar-days', 'calendar-off', 'camera', 'chevron-down', 'chevron-right',
    'clock-3', 'coins', 'layers-3', 'map-pin', 'plus', 'refresh-cw', 'search', 'trash-2', 'x',
];
const source = path.dirname(require.resolve('lucide-static/package.json'));
const destination = path.resolve(__dirname, '../public/assets/icons');
const { version } = require('lucide-static/package.json');
const symbols = names.map(name => {
    const svg = fs.readFileSync(path.join(source, 'icons', `${name}.svg`), 'utf8');
    const body = svg.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1];
    if (!body) throw new Error(`Invalid Lucide icon: ${name}`);
    return `<symbol id="${name}" viewBox="0 0 24 24">${body.trim().replace(/\s+/g, ' ')}</symbol>`;
});
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, 'lucide.svg'), `<!-- @license lucide-static v${version}; see lucide-LICENSE.txt -->\n<svg xmlns="http://www.w3.org/2000/svg">\n${symbols.join('\n')}\n</svg>\n`);
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(destination, 'lucide-LICENSE.txt'));
console.log(`Generated ${names.length} local Lucide icons (v${version}).`);
