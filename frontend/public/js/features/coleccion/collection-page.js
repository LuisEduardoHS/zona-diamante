import { collectionApi } from '../../api/collection-client.js';
import { observarEstadoSesion } from '../auth/session.js';
import { obtenerEquipos } from '../../services/datos-equipos.js';
import { RUTAS, ruta, baseURL } from '../../app/rutas.js';
import { createCollectionStore, purchaseJournal } from './store.js';
import { TYPES, filterCards, progress, canPurchase, number, errorMessage } from './model.js';
import { cardTile, cardFace, escapeHTML as e } from './view.js';

const mounts = new WeakMap();
export function iniciarColeccion(signal) {
    const root = document.getElementById('coleccion');
    if (!root || signal?.aborted) return;
    mounts.get(root)?.();
    const lifecycle = new AbortController(), options = { signal: lifecycle.signal };
    const $ = id => root.querySelector(`#${id}`);
    const dialog = $('col-detail'), grid = $('col-grid');
    let teams = [], selected = null, confirming = false, lastUid, lastSuccess = null;
    let filter = { ownership: 'all', team: '', type: '', sort: 'catalog' }, filterSignature = '';
    let stopped = false;
    const login = ruta(RUTAS.login) + '?next=' + encodeURIComponent(ruta(RUTAS.coleccion));
    const storage = { getItem: key => localStorage.getItem(key), setItem: (key,value) => localStorage.setItem(key,value), removeItem: key => localStorage.removeItem(key) };
    const store = createCollectionStore({ api: collectionApi, journal: purchaseJournal(storage), onChange: render, describeError: errorMessage });
    function render(state) {
        if (stopped) return;
        const cards = state.data?.cards || [], stats = progress(cards);
        root.setAttribute('aria-busy', String(state.loading));
        $('col-balance').textContent = state.uid ? state.data && !state.expired ? number(state.data.points_balance) : '—' : '—';
        $('col-balance-label').textContent = state.uid ? 'PUNTOS DISPONIBLES' : 'INICIA SESIÓN PARA SUMAR';
        $('col-progress-copy').textContent = state.data ? state.uid ? `${stats.owned} de ${stats.total} cartas` : `${stats.total} cartas por descubrir` : 'Cargando tu álbum…';
        $('col-progress').value = state.uid ? stats.percent : 0;
        $('col-progress-percent').textContent = state.data && state.uid ? `${stats.percent}%` : 'Tu siguiente gran colección';
        $('col-auth').hidden = Boolean(state.uid && !state.expired);
        $('col-login').href = login;
        $('col-login').textContent = state.expired ? 'Volver a iniciar sesión' : 'Iniciar sesión';
        $('col-notice').textContent = state.storageError ? 'No se pudo leer o guardar la recuperación local. Habilita el almacenamiento y recarga antes de comprar.' : state.notice;
        $('col-notice').hidden = !state.notice && !state.storageError;
        $('col-refresh').disabled = state.loading || state.busy;
        $('col-recovery').hidden = !state.pending;
        $('col-retry-purchase').disabled = state.busy || state.loading || state.stale || state.expired || state.storageError;
        $('col-recovery-copy').textContent = state.busy ? 'Confirmando compra…' : 'Hay una compra pendiente de confirmar. Reintentar usa la misma solicitud.';
        const signature = cards.map(c => `${c.id}:${c.team_slug}`).join('|');
        if (signature !== filterSignature) {
            filterSignature = signature;
            const clubs = [...new Map(cards.map(c => [c.team_slug,c.team_name])).entries()];
            $('col-team').innerHTML = '<option value="">Todos los equipos</option>' + clubs.map(([id,name]) => `<option value="${e(id)}">${e(name)}</option>`).join('');
            if (!clubs.some(([id]) => id === filter.team)) filter.team = '';
            $('col-team').value = filter.team;
        }
        const visible = filterCards(cards,filter);
        $('col-count').textContent = state.data ? `${visible.length} ${visible.length === 1 ? 'carta' : 'cartas'}` : 'Cargando…';
        grid.innerHTML = !state.data && state.loading ? Array.from({length:6},() => '<div class="col-skeleton" aria-hidden="true"></div>').join('')
            : visible.map(c => cardTile(c,teams.find(t => t.id === c.team_slug),baseURL)).join('');
        $('col-empty').hidden = Boolean(visible.length) || state.loading;
        $('col-empty-title').textContent = !state.data ? 'Tu álbum está tomando un descanso' : cards.length ? 'Aquí comienza la siguiente carta' : 'El catálogo aún no está disponible';
        $('col-empty-copy').textContent = !state.data ? 'No pudimos cargar las cartas. Vuelve a intentar.' : cards.length ? 'Prueba otros filtros o descubre las cartas disponibles.' : 'Actualiza en unos momentos.';
        if (state.success && state.success !== lastSuccess) {
            confirming = false;
            const tile = grid.querySelector(`[data-card="${state.success}"]`);
            tile?.classList.add('col-acquired');
        }
        lastSuccess = state.success;
        if (dialog.open) renderDetail();
    }
    function renderDetail() {
        const state = store.state, card = state.data?.cards.find(c => c.id === selected);
        if (!card) { dialog.close(); return; }
        $('col-detail-art').innerHTML = cardFace(card,teams.find(t => t.id === card.team_slug),baseURL);
        $('col-detail-title').textContent = card.name;
        $('col-detail-type').textContent = `${TYPES[card.card_type]} · ${card.team_name}`;
        $('col-detail-description').textContent = card.description || 'Una carta para llevar tu afición al siguiente nivel.';
        $('col-detail-price').textContent = card.is_owned ? '✓ En tu colección' : card.unlock_method === 'ar' ? 'Exclusiva AR · no se compra con puntos' : `${number(card.cost)} puntos`;
        const insufficient = state.data.points_balance < card.cost;
        const buy = !card.is_owned && card.unlock_method === 'points' && card.card_type !== 'mascot';
        $('col-buy').hidden = !buy || !state.uid || confirming || Boolean(state.success === selected);
        $('col-buy').disabled = !canPurchase(state,card) || state.storageError;
        $('col-buy').textContent = insufficient ? 'Puntos insuficientes' : 'Desbloquear carta';
        $('col-detail-login').hidden = Boolean(state.uid && !state.expired) || card.is_owned;
        $('col-detail-login').href = login;
        $('col-detail-ar').hidden = card.unlock_method !== 'ar';
        $('col-detail-ar').href = ruta(RUTAS.camara);
        $('col-ar-note').hidden = card.unlock_method !== 'ar' || card.is_owned;
        $('col-confirm').hidden = !confirming || card.is_owned;
        $('col-confirm-copy').textContent = `¿Usar ${number(card.cost)} puntos para desbloquear esta carta?`;
        $('col-confirm-buy').disabled = !canPurchase(state,card) || state.storageError;
        $('col-confirm-buy').textContent = state.busy ? 'Confirmando…' : 'Confirmar compra';
        $('col-cancel-buy').disabled = state.busy;
        $('col-detail-close').disabled = state.busy;
        $('col-detail-state').textContent = state.busy ? 'Confirmando con el servidor…' : state.success === selected ? '¡Adquirida! Ya forma parte de tu álbum.' : state.notice;
        $('col-detail-state').classList.toggle('col-success', state.success === selected);
        $('col-detail-trivia').hidden = !buy || !state.uid || !insufficient;
        $('col-detail-trivia').href = ruta(RUTAS.trivia);
    }
    grid.addEventListener('click', event => {
        const tile = event.target.closest('[data-card]'); if (!tile) return;
        selected = Number(tile.dataset.card); confirming = false;
        dialog.showModal(); renderDetail();
    },options);
    root.addEventListener('error', event => {
        const img = event.target;
        if (img.tagName !== 'IMG') return;
        const fallback = img.dataset.fallback;
        if (fallback && img.src !== fallback) { img.src = fallback; img.dataset.fallback = ''; }
        else { img.hidden = true; img.nextElementSibling?.removeAttribute('hidden'); }
    },{ ...options, capture: true });
    root.addEventListener('click', event => {
        const chip = event.target.closest('[data-ownership],[data-type]'); if (!chip) return;
        if (chip.hasAttribute('data-ownership')) filter.ownership = chip.dataset.ownership;
        else filter.type = chip.dataset.type;
        const attr = chip.hasAttribute('data-ownership') ? 'data-ownership' : 'data-type';
        root.querySelectorAll(`[${attr}]`).forEach(b => b.setAttribute('aria-pressed',String(b === chip)));
        render(store.state);
    },options);
    for (const [id,key] of [['col-team','team'],['col-sort','sort']]) $(id).addEventListener('change',event => { filter[key] = event.target.value; render(store.state); },options);
    $('col-reset').addEventListener('click',() => {
        filter = { ownership:'all',team:'',type:'',sort:'catalog' };
        $('col-team').value = ''; $('col-sort').value = 'catalog';
        root.querySelectorAll('[data-ownership]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.ownership === 'all')));
        root.querySelectorAll('[data-type]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.type === '')));
        render(store.state);
    },options);
    $('col-refresh').addEventListener('click',() => store.refresh(),options);
    $('col-retry-purchase').addEventListener('click',() => store.purchase(null,true),options);
    $('col-buy').addEventListener('click',() => { confirming = true; renderDetail(); $('col-confirm-buy').focus(); },options);
    $('col-cancel-buy').addEventListener('click',() => { confirming = false; renderDetail(); $('col-buy').focus(); },options);
    $('col-confirm-buy').addEventListener('click',() => { void store.purchase(store.state.data.cards.find(c => c.id === selected)); },options);
    $('col-detail-close').addEventListener('click',() => dialog.close(),options);
    dialog.addEventListener('cancel',event => { if (store.state.busy) event.preventDefault(); },options);
    window.addEventListener('focus',() => { if (!store.state.busy && !store.state.loading) void store.refresh(); },options);
    const unsubscribe = observarEstadoSesion(auth => {
        if (auth.cargando) return;
        const uid = auth.user?.id || null;
        if (lastUid !== uid) { lastUid = uid; selected = null; if (dialog.open) dialog.close(); void store.setUser(uid); }
    });
    void obtenerEquipos().then(data => { if (!stopped) { teams = data; render(store.state); } }).catch(() => {}); // Logos are optional; monograms remain usable.
    function cleanup() { if (stopped) return; stopped = true; unsubscribe(); store.destroy(); lifecycle.abort(); if (dialog.open) dialog.close(); mounts.delete(root); }
    signal?.addEventListener('abort',cleanup,{once:true});
    window.addEventListener('pagehide',cleanup,options);
    mounts.set(root,cleanup);
}
