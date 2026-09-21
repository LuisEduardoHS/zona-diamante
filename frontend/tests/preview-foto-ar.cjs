// Prueba visual local sin acceso a la cámara real: node tests/preview-foto-ar.cjs
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const publicRoot = path.resolve(__dirname, '../public');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.otf': 'font/otf', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.json': 'application/json' };

const fixture = `
import { iniciarFotoAR } from '/js/foto-ar.js';
const escena = document.querySelector('a-scene');
if (!escena.hasLoaded) await new Promise(resolve => escena.addEventListener('loaded', resolve, { once: true }));
const fondo = document.createElement('canvas');
fondo.width = 1280; fondo.height = 720;
const ctx = fondo.getContext('2d');
function dibujar() {
    const cielo = ctx.createLinearGradient(0, 0, 0, 400);
    cielo.addColorStop(0, '#518697'); cielo.addColorStop(1, '#bfd9d4');
    ctx.fillStyle = cielo; ctx.fillRect(0, 0, 1280, 400);
    ctx.fillStyle = '#326844'; ctx.fillRect(0, 400, 1280, 320);
    ctx.fillStyle = '#bc9671'; ctx.beginPath(); ctx.moveTo(640, 420); ctx.lineTo(930, 570); ctx.lineTo(640, 710); ctx.lineTo(350, 570); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '20px Urbanist'; ctx.fillText('Prueba local · fondo simulado', 470, 55);
    requestAnimationFrame(dibujar);
}
dibujar();
const video = document.createElement('video');
video.muted = true; video.autoplay = true; video.playsInline = true;
video.style.zIndex = '-2'; document.body.appendChild(video);
video.srcObject = fondo.captureStream(15); await video.play();
escena.systems['mindar-image-system'] = { video };
document.querySelectorAll('[id^="target-"]').forEach(target => target.object3D.visible = false);
const modelo = document.getElementById('modelo-camara');
modelo.setAttribute('src', './ar/models/Algodoneros_color.glb');
await new Promise(resolve => modelo.addEventListener('model-loaded', resolve, { once: true }));
const caja = new AFRAME.THREE.Box3().setFromObject(modelo.getObject3D('mesh'));
const esfera = caja.getBoundingSphere(new AFRAME.THREE.Sphere());
const escala = 1.1 / esfera.radius;
modelo.setAttribute('scale', { x: escala, y: escala, z: escala });
modelo.setAttribute('position', { x: -esfera.center.x * escala, y: -esfera.center.y * escala, z: -4 - esfera.center.z * escala });
modelo.setAttribute('visible', true);
document.getElementById('luz-principal').setAttribute('position', '-0.35 0.65 1.2');
document.getElementById('ar-ui').classList.add('hidden');
const fotos = iniciarFotoAR({ escena, puedeCapturar: () => true, obtenerEquipo: () => 'Algodoneros' });
fotos.activar(true);
`;

http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://127.0.0.1:4173');
        res.setHeader('Cache-Control', 'no-store');
        if (url.pathname === '/__navigation-tests') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`<!doctype html><html lang="es"><title>Pruebas de navegación</title><body><button id="ejecutar">Ejecutar pruebas de navegación</button><pre id="resultado" role="log"></pre><iframe id="sitio" title="Sitio bajo prueba" src="/index.html" width="390" height="740" allow="web-share"></iframe><script type="module" src="/__navigation-tests.js"></script></body></html>`);
            return;
        }
        if (url.pathname === '/__navigation-tests.js') {
            res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
            res.end(await fs.readFile(path.join(__dirname, 'navegacion-browser.js'))); return;
        }
        if (url.pathname === '/__foto-review') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`<!doctype html><html lang="es"><title>Prueba local · Foto AR</title><body style="margin:0;background:#202126;color:white;font:14px system-ui;text-align:center"><p>Prueba local con fondo simulado · <button onclick="t.width=390;t.height=740">Móvil</button> <button onclick="t.width=760;t.height=390">Horizontal</button> <button onclick="t.width=1024;t.height=768">Escritorio</button></p><iframe id="t" title="Cámara de prueba" src="/__foto-fixture" width="390" height="740" style="border:0;border-radius:18px" allow="web-share"></iframe></body></html>`);
            return;
        }
        if (url.pathname === '/__foto-fixture.js') {
            res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
            res.end(fixture); return;
        }
        if (url.pathname === '/__foto-fixture' || (url.pathname === '/ar-vista.html' && (process.env.ZD_AR_SIMULADA === '1' || process.argv.includes('--simular-ar')))) {
            const html = (await fs.readFile(path.join(publicRoot, 'ar-vista.html'), 'utf8'))
                .replace('<script src="./js/libs/mindar-image-aframe.prod.js"></script>', '')
                .replace(/mindar-image="[^"]*"/g, '')
                .replace(/mindar-image-target="[^"]*"/g, '')
                .replace('src="./js/camara.js"', 'src="/__foto-fixture.js"');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(html); return;
        }
        const filename = path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!filename.startsWith(publicRoot + path.sep)) { res.writeHead(403).end(); return; }
        const data = await fs.readFile(filename);
        res.setHeader('Content-Type', tipos[path.extname(filename)] || 'application/octet-stream');
        res.end(data);
    } catch {
        res.writeHead(404).end('No encontrado');
    }
}).listen(4173, '127.0.0.1', () => console.log('Prueba visual: http://127.0.0.1:4173/__foto-review'));
