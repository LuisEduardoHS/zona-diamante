import { solicitarBackend } from '../../api/backend-client.js';

export function iniciarPreferenciasCorreo(signal) {
    const form = document.getElementById('perfil-avisos-form');
    if (!form || signal?.aborted) return;
    const input = form.querySelector('input'), button = form.querySelector('button');
    const status = form.querySelector('[role="status"]');
    let original = null;
    const busy = value => { form.setAttribute('aria-busy', String(value)); input.disabled = value || original === null; button.disabled = value; };
    const load = async () => {
        busy(true); status.textContent = 'Cargando tus preferencias…';
        try {
            const data = await solicitarBackend('/api/v1/email/preferences', { signal });
            if (signal?.aborted) return;
            original = data.trivia_email_enabled; input.checked = original;
            status.textContent = ''; button.textContent = 'Guardar preferencia';
        } catch (error) {
            if (signal?.aborted) return;
            status.textContent = 'No pudimos consultar tus avisos. Reintenta.'; button.textContent = 'Reintentar';
        } finally { if (!signal?.aborted) busy(false); }
    };
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (original === null) { await load(); return; }
        busy(true); status.textContent = 'Guardando…';
        try {
            const data = await solicitarBackend('/api/v1/email/preferences', {
                method: 'PATCH', body: { trivia_email_enabled: input.checked }, signal,
            });
            if (signal?.aborted) return;
            original = data.trivia_email_enabled; input.checked = original;
            status.textContent = original ? 'Avisos de trivia activados.' : 'Avisos de trivia desactivados.';
        } catch (error) {
            if (signal?.aborted) return;
            input.checked = original; status.textContent = 'No pudimos guardar el cambio. Tu preferencia anterior se conserva.';
        } finally { if (!signal?.aborted) busy(false); }
    }, { signal });
    void load();
}
