import { solicitarBackend } from '../../api/backend-client.js';

function normalizar(texto) {
    return texto.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function iniciarAyuda(signal) {
    const app = document.getElementById('ayuda-app');
    if (!app || app.dataset.iniciada === 'true') return;
    app.dataset.iniciada = 'true';
    const busqueda = document.getElementById('ayuda-busqueda');
    const limpiar = document.getElementById('ayuda-limpiar');
    const sinResultados = document.getElementById('ayuda-sin-resultados');
    const preguntas = [...app.querySelectorAll('.ayuda-pregunta')];
    let filtro = 'todas';

    const actualizar = () => {
        const termino = normalizar(busqueda.value.trim());
        let visibles = 0;
        preguntas.forEach(pregunta => {
            const coincideTema = filtro === 'todas' || pregunta.dataset.tema === filtro;
            const coincideTexto = !termino || normalizar(pregunta.textContent).includes(termino);
            const visible = coincideTema && coincideTexto;
            pregunta.classList.toggle('hidden', !visible);
            if (visible) visibles += 1;
        });
        limpiar.classList.toggle('hidden', !busqueda.value);
        sinResultados.classList.toggle('hidden', visibles > 0);
    };

    busqueda.addEventListener('input', actualizar);
    limpiar.addEventListener('click', () => { busqueda.value = ''; busqueda.focus(); actualizar(); });
    app.querySelectorAll('.ayuda-filtro').forEach(boton => boton.addEventListener('click', () => {
        filtro = boton.dataset.filtro;
        app.querySelectorAll('.ayuda-filtro').forEach(otro => {
            const activo = otro === boton;
            otro.setAttribute('aria-pressed', String(activo));
            otro.classList.toggle('bg-[#2b2b31]', activo);
            otro.classList.toggle('text-white', activo);
            otro.classList.toggle('bg-white', !activo);
        });
        actualizar();
    }));
    const formulario = document.getElementById('ayuda-formulario');
    const motivo = document.getElementById('ayuda-tipo');
    const contacto = document.getElementById('ayuda-contacto');
    const mensaje = document.getElementById('ayuda-mensaje');
    const confirmacion = document.getElementById('ayuda-confirmacion');
    const boton = formulario?.querySelector('button[type="submit"]');
    let enviando = false, pendiente = null;
    formulario?.addEventListener('submit', async event => {
        event.preventDefault();
        if (enviando || signal?.aborted) return;
        const contenido = { reason: motivo.value, contact: contacto.value.trim(), message: mensaje.value.trim() };
        confirmacion.classList.remove('hidden');
        if (contenido.message.length < 10) {
            confirmacion.textContent = 'Escribe al menos 10 caracteres para que podamos ayudarte.';
            mensaje.focus(); return;
        }
        const firma = JSON.stringify(contenido);
        if (!pendiente || pendiente.firma !== firma) pendiente = { firma, id: crypto.randomUUID() };
        enviando = true;
        formulario.setAttribute('aria-busy', 'true');
        [motivo, contacto, mensaje, boton].forEach(control => { control.disabled = true; });
        boton.textContent = 'Enviando…';
        confirmacion.textContent = 'Enviando tu mensaje…';
        confirmacion.classList.remove('text-red-700');
        try {
            const recibido = await solicitarBackend('/api/v1/help/feedback', {
                method: 'POST', body: { request_id: pendiente.id, ...contenido }, signal,
            });
            if (!recibido?.id || recibido.status !== 'received') throw new Error('No se confirmó la recepción.');
            if (signal?.aborted) return;
            pendiente = null;
            formulario.reset();
            confirmacion.textContent = 'Gracias. Recibimos tu mensaje y lo enviaremos al equipo de Zona Diamante.';
        } catch (error) {
            if (signal?.aborted) return;
            confirmacion.classList.add('text-red-700');
            confirmacion.textContent = error.status === 401
                ? 'Inicia sesión con tu cuenta para enviar el mensaje. Tu texto se conserva aquí.'
                : error.status === 403 || error.status === 429 || error.status === 409
                    ? error.message
                    : 'No pudimos confirmar el envío. Tu texto se conserva; vuelve a intentarlo y no se duplicará.';
        } finally {
            enviando = false;
            if (!signal?.aborted) {
                formulario.setAttribute('aria-busy', 'false');
                [motivo, contacto, mensaje, boton].forEach(control => { control.disabled = false; });
                boton.textContent = 'Enviar mensaje';
                confirmacion.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, { signal });
    if (boton) boton.disabled = false;
}
