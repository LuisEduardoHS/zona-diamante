// Journal contains only a request key/card ID, scoped by authenticated identity.
// It is recovery metadata, never evidence of ownership or permission to buy.
export function purchaseJournal(storage) {
    const key = uid => `zd:collection:pending:${uid}`;
    return {
        read(uid) {
            const raw = storage.getItem(key(uid));
            if (!raw) return null;
            const entry = JSON.parse(raw);
            if (!Number.isSafeInteger(entry.cardId) || entry.cardId < 1 || typeof entry.key !== 'string'
                || entry.key.length < 1 || entry.key.length > 128) throw new Error('Invalid recovery entry');
            return entry;
        },
        write(uid, entry) { storage.setItem(key(uid), JSON.stringify(entry)); },
        clear(uid) { storage.removeItem(key(uid)); }
    };
}

export function createCollectionStore({ api, journal, onChange = () => {}, newKey = () => crypto.randomUUID(), timeout = 20000,
    describeError = error => error?.status === 401 ? 'Tu sesión venció. Inicia sesión para continuar.' : 'No pudimos actualizar. Los datos anteriores pueden estar desactualizados.' }) {
    let state = { uid: null, data: null, loading: true, stale: false, expired: false, busy: false,
        pending: null, notice: '', success: null, storageError: false };
    let generation = 0, readVersion = 0, destroyed = false;
    const requests = new Set();
    const emit = patch => { state = { ...state, ...patch }; if (!destroyed) onChange(state); };
    async function call(fn) {
        const abort = new AbortController(); requests.add(abort);
        const timer = setTimeout(() => abort.abort(), timeout);
        try { return await fn(abort.signal); }
        finally { clearTimeout(timer); requests.delete(abort); }
    }
    const current = g => !destroyed && g === generation;
    const clearPending = () => {
        try { journal.clear(state.uid); emit({ pending: null }); }
        catch { emit({ storageError: true, notice: 'No pudimos actualizar la recuperación local. No vuelvas a comprar hasta actualizar.' }); }
    };
    async function refresh() {
        const g = generation, read = ++readVersion;
        emit({ loading: true, success: null });
        try {
            const data = await call(signal => state.uid ? api.collection(signal) : api.catalog(signal));
            if (!current(g) || read !== readVersion) return false;
            emit({ data, loading: false, stale: false, expired: false, notice: '' });
            if (state.pending && data.cards.some(c => c.id === state.pending.cardId && c.is_owned)) {
                clearPending(); emit({ notice: 'Propiedad confirmada por el servidor. Tu álbum está actualizado.' });
            }
            return true;
        } catch (error) {
            if (current(g) && read === readVersion) emit({ loading: false, stale: true, expired: error?.status === 401,
                notice: describeError(error) });
            return false;
        }
    }
    async function setUser(uid) {
        if (state.uid === uid && !state.loading && state.data) return;
        generation++; readVersion++; requests.forEach(r => r.abort());
        let pending = null, storageError = false;
        if (uid) try { pending = journal.read(uid); } catch { storageError = true; }
        emit({ uid, data: null, loading: true, stale: false, expired: false, busy: false, pending,
            success: null, notice: '', storageError });
        await refresh();
    }
    async function purchase(card, retry = false) {
        if (state.busy || state.loading || state.stale || state.expired || state.storageError || !state.uid) return;
        if (retry ? !state.pending : state.pending || !card || card.is_owned || card.unlock_method !== 'points'
            || card.card_type === 'mascot' || !(card.cost > 0) || state.data?.points_balance < card.cost) return;
        const g = generation, uid = state.uid;
        const operation = retry ? state.pending : { cardId: card.id, key: newKey() };
        try { journal.write(uid, operation); }
        catch { emit({ storageError: true, notice: 'Habilita el almacenamiento del navegador para comprar con recuperación segura.' }); return; }
        ++readVersion; // A read started before this purchase must not overwrite its response.
        emit({ busy: true, pending: operation, success: null, notice: '' });
        try {
            const result = await call(signal => api.purchase(operation.cardId, operation.key, signal));
            if (!current(g)) return;
            // The atomic result is authoritative; never deduct a client-side price.
            if (result.card_id !== operation.cardId || result.user_id !== uid || !result.reward_id
                || !Number.isInteger(result.points_balance) || result.points_balance < 0) throw new Error('Invalid purchase response');
            clearPending();
            emit({ data: { ...state.data, points_balance: result.points_balance,
                cards: state.data.cards.map(c => c.id === operation.cardId ? { ...c, is_owned: true, source: 'points' } : c) },
                busy: false, success: operation.cardId, notice: result.already_processed ? 'Compra confirmada. No se realizó un segundo cobro.' : '¡Una nueva carta para tu álbum!' });
        } catch (error) {
            if (!current(g)) return;
            // 5xx/network/abort may happen AFTER commit. Preserve the SAME request key.
            const definitive = [400, 403, 404, 409, 422, 429].includes(error?.status);
            if (definitive) clearPending();
            emit({ busy: false, expired: error?.status === 401, notice: definitive ? describeError(error) : 'Respuesta pendiente. Comprobamos tu colección antes de reintentar.' });
            const message = state.notice;
            const updated = await refresh();
            if (current(g) && updated && !state.notice) emit({ notice: definitive ? message : state.pending ? 'Resultado incierto. Reintenta la misma operación para confirmar.' : 'Propiedad confirmada por el servidor.' });
        }
    }
    return { get state() { return state; }, setUser, refresh, purchase,
        destroy() { destroyed = true; generation++; requests.forEach(r => r.abort()); } };
}
