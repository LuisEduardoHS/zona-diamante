export const TYPES = { team: 'Equipos', player: 'Jugadores', mvp_player: 'MVP', mascot: 'Mascotas' };
export const number = value => new Intl.NumberFormat('es-MX').format(value);
export function filterCards(cards, { ownership = 'all', team = '', type = '', sort = 'catalog' } = {}) {
    const filtered = cards.filter(card => (!team || card.team_slug === team) && (!type || card.card_type === type)
        && (ownership === 'all' || Boolean(card.is_owned) === (ownership === 'owned')));
    if (sort === 'name') filtered.sort((a,b) => a.name.localeCompare(b.name, 'es'));
    if (sort === 'price') filtered.sort((a,b) => a.cost - b.cost || a.id - b.id);
    return filtered;
}
export function progress(cards) {
    const owned = cards.filter(card => card.is_owned).length;
    return { owned, total: cards.length, percent: cards.length ? Math.round(owned / cards.length * 100) : 0 };
}
export function canPurchase(state, card) {
    return Boolean(state.uid && !state.expired && !state.loading && !state.stale && !state.busy && !state.pending && !state.storageError
        && card && !card.is_owned && card.unlock_method === 'points' && card.card_type !== 'mascot'
        && Number.isInteger(card.cost) && card.cost > 0 && state.data?.points_balance >= card.cost);
}
export function errorMessage(error) {
    const detail = error?.data?.detail || error?.message || '';
    if (error?.status === 401) return 'Tu sesión venció. Inicia sesión para continuar.';
    if (error?.status === 403) return 'No tienes permiso para realizar esta operación.';
    if (/Insufficient points/.test(detail)) return 'Puntos insuficientes. Actualizamos tu saldo.';
    if (/already owned/.test(detail)) return 'Esta carta ya está en tu colección.';
    if (/not active|not available|not found/.test(detail)) return 'Esta carta ya no está disponible. Actualiza el catálogo.';
    if (/cannot be purchased/.test(detail)) return 'Esta carta no se puede comprar con puntos.';
    if (error?.status === 429) return 'Demasiados intentos. Espera un momento y vuelve a intentar.';
    if ([400, 409, 422].includes(error?.status)) return 'No se pudo confirmar esta operación. Actualiza o contacta soporte si persiste.';
    return 'No pudimos conectar. Tus datos pueden estar desactualizados.';
}
