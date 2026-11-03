const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../public');
const walk=folder=>fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(folder,entry.name)):[path.join(folder,entry.name)]);
let pages=0,assets=0;
for(const file of walk(root).filter(file=>file.endsWith('.html'))){
 const html=fs.readFileSync(file,'utf8');if(!html.trim())continue;
 const sheets=[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).filter(tag=>/rel=["']stylesheet["']/i.test(tag));
 assert.equal(sheets.length,1,`${path.relative(root,file)} must use the single Tailwind bundle`);
 assert.match(sheets[0],/css\/output\.css(?:\?[^"']*)?["']/);
 assert.doesNotMatch(html,/<style\b|\sstyle\s*=/i,`${file}: static styles belong in Tailwind`);pages++;
}
assert.deepEqual(fs.readdirSync(path.join(root,'css')).filter(file=>file.endsWith('.css')),['output.css']);
const css=fs.readFileSync(path.join(root,'css/output.css'),'utf8');
assert.doesNotMatch(css,/@apply\b|@import\s/, 'Tailwind must be compiled before publication');
for(const match of css.matchAll(/url\(([^)]+)\)/g)){
 const url=match[1].trim().replace(/^["']|["']$/g,'');if(/^(data:|https?:|#)/.test(url))continue;
 assert.ok(fs.existsSync(path.resolve(root,'css',url.split(/[?#]/)[0])),`Missing compiled stylesheet asset: ${url}`);assets++;
}
console.log(`PASS: ${pages} pages share one compiled Tailwind stylesheet; ${assets} local CSS assets resolve; no standalone styles or inline HTML CSS.`);
