import { readFile } from 'node:fs/promises';
const cache = new Map();
async function moduleURL(file) {
    if (!cache.has(file.href)) cache.set(file.href,(async()=>{
        let source = await readFile(file,'utf8');
        for (const match of [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)]) {
            if (match[1].startsWith('.')) source = source.replace(match[0],`from '${await moduleURL(new URL(match[1],file))}'`);
        }
        return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
    })());
    return cache.get(file.href);
}
export const loadModule = async file => import(await moduleURL(file));
export const loadGame = name => loadModule(new URL('../public/js/features/juego/'+name,import.meta.url));
export const rules = JSON.parse(await readFile(new URL('../../backend/app/core/game_beta_rules.json',import.meta.url),'utf8'));
export const art = JSON.parse(await readFile(new URL('../public/data/game-beta-art.json',import.meta.url),'utf8'));
