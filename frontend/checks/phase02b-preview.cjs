// Dependency-free loopback server. Simulated camera/detection are ONLY available
// through explicit /__ar test URL. Production files contain no simulation flag.
const http=require('node:http'), fs=require('node:fs/promises'), path=require('node:path');
const root=path.resolve(__dirname,'../public');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.glb':'model/gltf-binary','.mind':'application/octet-stream','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf'};
const types={'360':'360x740','390':'390x844','768':'768x1024','1440':'1440x900','844':'844x390'};
const portArg=process.argv.indexOf('--port');
const port=portArg<0 ? 4174 : Number(process.argv[portArg+1]);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local preview port');
const observerTrace=process.argv.includes('--observer-trace');
const tracePath=path.resolve(__dirname,'../../.tmp/observer-investigation',`trace-${Date.now()}-${process.pid}.jsonl`);
const htmlResponse=(res,html)=>{
    res.setHeader('Content-Type','text/html; charset=utf-8');
    const script='<script src="/__observer-diagnostic.js"></script>';
    res.end(observerTrace ? (html.includes('<head>') ? html.replace('<head>','<head>'+script) : script+html) : html);
};
const server=http.createServer(async(req,res)=>{
    try{
        const url=new URL(req.url,'http://127.0.0.1'); res.setHeader('Cache-Control','no-store');
        if(url.pathname==='/__observer-lab'){
            const cases=['empty-direct','empty-frame','delayed-frame','aframe-direct','aframe-frame'];
            res.setHeader('Content-Type','text/html; charset=utf-8');
            res.end('<!doctype html><html><head><title>Observer reproduction lab</title></head><body><h1>Observer reproduction lab</h1><p>Local isolation cases. No camera or user data.</p>'+cases.map(c=>`<p><a href="/__observer-case?kind=${c}">${c}</a></p>`).join('')+'</body></html>');return;
        }
        if(url.pathname==='/__observer-case'){
            const kind=url.searchParams.get('kind');
            const allowed=['empty-direct','empty-frame','delayed-frame','aframe-direct','aframe-frame'];
            if(!allowed.includes(kind)){res.writeHead(400).end();return;}
            const frame=kind.endsWith('-frame');
            const src=kind==='delayed-frame' ? '/__observer-slow' : '/__observer-case?kind='+ (kind==='aframe-frame' ? 'aframe-direct' : 'empty-direct');
            const html=`<!doctype html><html><head><title>Observer case ${kind}</title>${kind==='aframe-direct'?'<script src="/vendor/aframe.min.js"></script>':''}</head><body><h1>${kind}</h1><p>Isolation case: ${kind.startsWith('empty')||kind==='delayed-frame'?'no application or dependency JavaScript':'only the existing A-Frame dependency'}.</p>${frame?`<iframe title="Isolation child" src="${src}" width="390" height="740"></iframe>`:kind==='aframe-direct'?'<a-scene embedded vr-mode-ui="enabled:false"></a-scene>':'<p>Empty document ready.</p>'}</body></html>`;
            // Empty cases intentionally contain ZERO JavaScript, even in trace
            // mode. A console error there cannot come from AR or its libraries.
            if(kind.startsWith('aframe'))htmlResponse(res,html);
            else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}return;
        }
        if(url.pathname==='/__observer-slow'){
            res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
            res.write('<!doctype html><html><head><title>Delayed empty child</title></head>');
            setTimeout(()=>res.end('<body><h1>Delayed child ready</h1><p>No JavaScript executed here.</p></body></html>'),1000);return;
        }
        if(observerTrace&&url.pathname==='/__observer-diagnostic.js'){
            res.setHeader('Content-Type','text/javascript');res.end(await fs.readFile(path.join(__dirname,'observer-diagnostic.js')));return;
        }
        if(observerTrace&&url.pathname==='/__observer-trace'&&req.method==='POST'){
            let body=''; for await(const chunk of req){body+=chunk;if(body.length>65536){res.writeHead(413).end();return;}}
            const entry=JSON.parse(body);
            await fs.mkdir(path.dirname(tracePath),{recursive:true});
            await fs.appendFile(tracePath,JSON.stringify(entry)+'\n');res.writeHead(204).end();return;
        }
        if(url.pathname==='/__review'){
            res.setHeader('Content-Type','text/html; charset=utf-8');
            htmlResponse(res,`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fase 2B · validación local</title><style>body{margin:12px;background:#15353d;color:white;font:13px system-ui}button,select{padding:8px;margin:3px}iframe{border:0;transform-origin:top center;flex:none}#marco{overflow:hidden;display:flex;justify-content:center}pre{white-space:pre-wrap;max-height:100px;overflow:auto}</style></head><body><p>Cámara y reconocimiento SIMULADOS · modelos GLB y módulos reales</p><label>Resolución <select id="size">${Object.entries(types).map(([k,v])=>`<option value="${v}" ${k==='390'?'selected':''}>${v}</option>`).join('')}</select></label><label>Cuenta <select id="account"><option>guest</option><option>pending</option><option>owned</option><option>error</option></select></label><div><button data-target="0">Algodoneros</button><button data-target="1">Charros</button><button data-target="2">Dorados</button><button data-target="3">Sultanes</button><button id="lost">Perder marcador</button><button id="tests">Probar editor y exportación</button><button id="layout">Comprobar diseño</button><button id="visual">Vista visual</button><button id="cleanup">Comprobar salida y recursos</button></div><pre id="results" role="log">Esperando interacción.</pre><div id="marco"><iframe id="visor" title="Experiencia AR bajo prueba" src="/__ar?estado=guest" allow="web-share"></iframe></div><script type="module" src="/__review.js"></script></body></html>`);return;
        }
        if(url.pathname==='/__ar'){
            let html=await fs.readFile(path.join(root,'pages/ar/ar-vista.html'),'utf8');
            html=html.replace('<head>','<head><base href="/pages/ar/ar-vista.html">')
                .replace('../../vendor/mindar-image-aframe.prod.js','/__ar-fixture.js')
                .replace(/mindar-image="[^"]*"/g,'').replace(/mindar-image-target="[^"]*"/g,'');
            htmlResponse(res,html);return;
        }
        if(url.pathname==='/js/api/backend-client.js'){
            res.setHeader('Content-Type','text/javascript');res.end(`export async function solicitarBackend(){const estado=new URLSearchParams(location.search).get('estado');if(estado==='guest')throw Object.assign(new Error('Fixture guest'),{status:401});if(estado==='error')throw new Error('Fixture network');return {mascots:['algodoneros-ul','charros-jal','dorados-chi','sultanes-mty'].map(team_slug=>({team_slug,card_name:'Mascota del equipo',is_owned:estado==='owned',browser_claim_enabled:false}))};}`);return;
        }
        const checks={'/__ar-fixture.js':'ar-fixture.js','/__review.js':'phase02b-browser.js'};
        if(checks[url.pathname]){res.setHeader('Content-Type','text/javascript');res.end(await fs.readFile(path.join(__dirname,checks[url.pathname])));return;}
        const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
        if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
        if(path.extname(file)==='.html'){htmlResponse(res,await fs.readFile(file,'utf8'));return;}
        res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
    }catch{res.writeHead(404).end('No encontrado');}
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Local AR review: http://127.0.0.1:${port}/__review${observerTrace?' (observer trace: '+tracePath+')':''}\n`));
