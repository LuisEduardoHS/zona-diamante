import { obtenerEquipos } from '../../services/datos-equipos.js';
import { ruta, RUTAS } from '../../app/rutas.js';

export const EQUIPOS_MARCADOR = Object.freeze(['algodoneros-ul', 'charros-jal', 'dorados-chi', 'sultanes-mty']);
export const fichaEquipo = id => `${ruta(RUTAS.equipo)}?id=${encodeURIComponent(id)}`;

// Reading is a snapshot: intermittent/new targets never replace an open panel.
export function crearContextoEquipo() {
    let actual = null;
    let lectura = null;
    return {
        get actual() { return actual; }, get lectura() { return lectura; },
        detectar(index) { actual = EQUIPOS_MARCADOR[index] || null; },
        abrir() { lectura = actual; return lectura; },
        cerrar() { lectura = null; },
    };
}

export function iniciarContextoEquipo({ consultar = async () => {
    const { solicitarBackend } = await import('../../api/backend-client.js');
    return solicitarBackend('/api/v1/ar/mascots');
} } = {}) {
    const contexto = crearContextoEquipo();
    const boton = document.getElementById('btn-info-equipo');
    const botones = [boton, document.getElementById('btn-info-inspector')].filter(Boolean);
    let origen = boton;
    const panel = document.getElementById('ar-equipo-panel');
    const cerrar = document.getElementById('ar-equipo-cerrar');
    const estado = document.getElementById('ar-mascota-status');
    const refrescar = document.getElementById('ar-mascota-consultar');
    let inventario = null;
    let mensaje = 'Consulta tu colección para conocer el estado de esta mascota.';
    let version = 0;
    let vivo = true;
    const mostrarEstado = () => {
        const mascota = inventario?.mascots?.find(row => row.team_slug === contexto.lectura);
        estado.textContent = mascota?.is_owned
            ? `${mascota.card_name} ya está en tu colección.`
            : mascota ? `${mascota.card_name}: pendiente de verificación. Reconocer el logo no entrega una carta todavía.` : mensaje;
        estado.dataset.estado = mascota?.is_owned ? 'owned' : mascota ? 'pending' : 'unknown';
    };
    const consultarEstado = async () => {
        const solicitud = ++version;
        inventario = null;
        mensaje = 'Consultando tu colección…';
        refrescar.disabled = true;
        mostrarEstado();
        try {
            const data = await consultar();
            if (solicitud !== version || !vivo) return;
            inventario = data;
        } catch (error) {
            if (solicitud !== version || !vivo) return;
            mensaje = error.status === 401
                ? 'Puedes disfrutar AR sin cuenta. Inicia sesión para consultar tus mascotas. El escaneo no concede cartas automáticamente.'
                : 'No pudimos consultar tu colección. Revisa tu conexión y vuelve a intentar. No se ha confirmado ninguna recompensa.';
        } finally {
            if (solicitud === version && vivo) { refrescar.disabled = false; mostrarEstado(); }
        }
    };
    const abrirPanel = async (event) => {
        if (panel.open || !contexto.actual) return;
        origen = event.currentTarget;
        const id = contexto.abrir();
        botones.forEach(button => { button.disabled = true; });
        try {
            const equipo = (await obtenerEquipos()).find(row => row.id === id);
            if (!vivo || !equipo || contexto.lectura !== id) return;
            document.getElementById('ar-equipo-nombre').textContent = equipo.nombre;
            document.getElementById('ar-equipo-ciudad').textContent = equipo.ciudad;
            const logo = document.getElementById('ar-equipo-logo');
            logo.src = equipo.imagenes.logoFondo; logo.alt = `Logo de ${equipo.nombre}`;
            document.getElementById('ar-equipo-historia').textContent = equipo.detalles.historia.slice(0,280) + (equipo.detalles.historia.length>280 ? '…' : '');
            document.getElementById('ar-equipo-estadio').textContent = equipo.detalles.estadio.nombre || 'Consulta la ficha del equipo';
            document.getElementById('ar-equipo-mascota').textContent = equipo.detalles.mascota.nombre || '';
            document.getElementById('ar-equipo-ficha').href = fichaEquipo(id);
            panel.showModal();
            void consultarEstado();
        } catch {
            document.getElementById('modelo-status').textContent = 'No pudimos abrir la información. Inténtalo de nuevo.';
            contexto.cerrar();
        } finally { if (vivo) botones.forEach(button => { button.disabled = false; }); }
    };
    botones.forEach(button => button.addEventListener('click', abrirPanel));
    cerrar.addEventListener('click', () => panel.close());
    panel.addEventListener('close', () => { contexto.cerrar(); origen.focus(); });
    refrescar.addEventListener('click', consultarEstado);
    window.addEventListener('pagehide', () => { vivo = false; ++version; }, { once:true });
    return { detectar(index) { contexto.detectar(index); } };
}
