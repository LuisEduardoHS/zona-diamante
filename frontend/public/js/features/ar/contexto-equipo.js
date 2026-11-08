import { ruta, RUTAS } from '../../app/rutas.js';
import { crearConfetiAR } from './confeti.js';

export const EQUIPOS_MARCADOR = Object.freeze(['algodoneros-ul', 'charros-jal', 'dorados-chi', 'sultanes-mty']);
const NOMBRES = ['Algodoneros', 'Charros', 'Dorados', 'Sultanes'];
export const fichaEquipo = id => `${ruta(RUTAS.equipo)}?id=${encodeURIComponent(id)}`;

export function crearContextoEquipo() {
    let actual = null;
    return {
        get actual() { return actual; },
        detectar(index) { actual = Number.isInteger(index) ? EQUIPOS_MARCADOR[index] || null : null; },
    };
}

export function iniciarContextoEquipo({ consultar = async () => {
    const { solicitarBackend } = await import('../../api/backend-client.js');
    return solicitarBackend('/api/v1/ar/mascots', { signal: AbortSignal.timeout(15000) });
}, reclamar = async team_slug => {
    const { solicitarBackend } = await import('../../api/backend-client.js');
    return solicitarBackend('/api/v1/ar/claim', { method: 'POST', body: { team_slug }, signal: AbortSignal.timeout(20000) });
}, confeti = crearConfetiAR() } = {}) {
    const contexto = crearContextoEquipo();
    const boton = document.getElementById('btn-reclamar-ar');
    const estado = document.getElementById('ar-carta-status');
    const aviso = document.getElementById('ar-equipo-aviso');
    const nombre = document.getElementById('ar-aviso-equipo');
    const login = document.getElementById('ar-carta-login');
    const inspector = document.getElementById('ar-equipo-inspector');
    const inventario = new Map(), operaciones = new Map(), mensajes = new Map(), celebrados = new Set();
    let consulta = null, consultando = false, vivo = true;
    login.href = ruta(RUTAS.login);

    function mostrar() {
        const id = contexto.actual, carta = inventario.get(id), mensaje = mensajes.get(id);
        boton.hidden = !id || carta?.is_owned === true;
        boton.disabled = consultando || operaciones.has(id);
        boton.textContent = operaciones.has(id) ? 'Reclamando…' : consultando ? 'Consultando carta…' : 'Reclamar carta AR';
        estado.textContent = mensaje?.texto || '';
        login.hidden = !mensaje?.login;
    }
    async function consultarEstado() {
        if (consulta) return consulta;
        consultando = true; mostrar();
        consulta = (async () => {
            try {
                const data = await consultar();
                if (!vivo) return;
                if (!Array.isArray(data?.mascots)) throw Error('Invalid inventory');
                for (const carta of data.mascots) {
                    // A late read must never undo a successfully claimed card.
                    if (!inventario.get(carta.team_slug)?.is_owned) inventario.set(carta.team_slug, carta);
                }
            } catch (error) {
                if (!vivo) return;
                mensajes.set(contexto.actual, error.status === 401
                    ? { texto: 'Inicia sesión para guardar tu carta AR.', login: true }
                    : { texto: 'No pudimos consultar tu colección. Puedes volver a intentar reclamar la carta.' });
            } finally {
                consultando = false; consulta = null; if (vivo) mostrar();
            }
        })();
        return consulta;
    }
    async function reclamarCarta() {
        const id = contexto.actual;
        if (!id || inventario.get(id)?.is_owned || operaciones.has(id)) return;
        const operation = (async () => {
            mensajes.delete(id);
            try {
                const result = await reclamar(id);
                if (!vivo) return;
                if (result?.mascot?.team_slug !== id || result.mascot.is_owned !== true) throw Error('Unconfirmed card');
                inventario.set(id, result.mascot);
                mensajes.delete(id);
                if (contexto.actual === id && !result.already_owned && !result.already_processed) confeti.lanzar();
            } catch (error) {
                if (!vivo) return;
                mensajes.set(id, error.status === 401
                    ? { texto: 'Inicia sesión para guardar tu carta AR.', login: true }
                    : { texto: 'No pudimos confirmar tu carta. Vuelve a intentarlo; no se duplicará.' });
            } finally {
                operaciones.delete(id); if (vivo) mostrar();
            }
        })();
        operaciones.set(id, operation); mostrar();
        return operation;
    }
    boton.addEventListener('click', reclamarCarta);
    window.addEventListener('pagehide', () => { vivo = false; confeti.destruir(); }, { once: true });
    return {
        detectar(index) {
            const anterior = contexto.actual;
            contexto.detectar(index);
            const id = contexto.actual;
            if (id === anterior) return;
            aviso.hidden = !id;
            if (!id) inspector.hidden = true;
            if (!id) { confeti.limpiar(); mostrar(); return; }
            nombre.textContent = `Conoce a ${NOMBRES[index]}`;
            aviso.href = fichaEquipo(id); inspector.href = fichaEquipo(id);
            if (!celebrados.has(id)) { celebrados.add(id); confeti.lanzar(); }
            mostrar();
            if (!inventario.has(id)) void consultarEstado();
        },
    };
}
