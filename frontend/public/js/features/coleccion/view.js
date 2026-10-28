const labels = { team: 'Equipo', player: 'Jugador', mvp_player: 'MVP', mascot: 'Mascota' };
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex = (value, fallback) => /^#[a-f\d]{6}$/i.test(value || '') ? value : fallback;
const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^el /,'').trim();
export function safeImage(value, base) {
    if (!value || typeof value !== 'string') return '';
    try { const url = new URL(value, base); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
}
export function artwork(card, team, base) {
    const logo = safeImage(team?.imagenes?.logoFondo, base);
    const direct = safeImage(card.image_path, base);
    const candidate = card.card_type === 'mascot' ? team?.detalles?.mascota : card.card_type === 'mvp_player' ? team?.detalles?.mvp : null;
    // An editorial photo belongs to its named subject, never another player.
    const matched = candidate && normalize(candidate.nombre) === normalize(card.name);
    return { image: direct || (matched ? safeImage(candidate.imagen, base) : '') || logo,
        portrait: Boolean(direct || matched), logo,
        primary: hex(team?.colores?.primario, '#006c7c'), secondary: hex(team?.colores?.secundario, '#f27b21') };
}
export function cardFace(card, team, base) {
    const art = artwork(card, team, base), e = escapeHTML;
    const initials = card.name.split(/\s+/).slice(0,2).map(p => p[0]).join('');
    return `<div class="col-face ${art.portrait ? 'col-face--portrait' : ''} col-face--${e(card.card_type)}" style="--club:${art.primary};--accent:${art.secondary}">
        <div class="col-card-top"><span>ZONA DIAMANTE</span><span>${e(labels[card.card_type] || 'Carta')}</span></div>
        <div class="col-art">${art.image ? `<img src="${e(art.image)}" data-fallback="${e(art.logo)}" alt="" loading="lazy" decoding="async">` : ''}<span class="col-monogram" ${art.image ? 'hidden' : ''}>${e(initials)}</span></div>
        ${!art.portrait && card.card_type !== 'team' ? `<span class="col-player-mark" aria-hidden="true">${card.card_type === 'mascot' ? 'AR' : e(initials)}</span>` : ''}
        <div class="col-card-caption"><span>${e(card.team_name)}</span><strong>${e(card.name)}</strong></div>
        <div class="col-card-foot"><span>CARTAS · ZONA DIAMANTE</span><span>#${e(String(card.id).padStart(2,'0'))}</span></div>
    </div>`;
}
export function cardTile(card, team, base) {
    const label = card.is_owned ? 'Adquirida' : card.unlock_method === 'ar' ? 'Exclusiva AR' : `${card.cost.toLocaleString('es-MX')} pts`;
    return `<button type="button" class="col-tile ${card.is_owned ? 'col-tile--owned' : ''}" data-card="${card.id}" aria-label="${escapeHTML(card.name)}, ${escapeHTML(label)}">
        ${cardFace(card,team,base)}<span class="col-tile-meta"><span>${card.is_owned ? '✓ Adquirida' : card.unlock_method === 'ar' ? 'Exclusiva AR' : 'Desbloquear'}</span><strong>${card.is_owned ? 'En tu álbum' : card.unlock_method === 'ar' ? 'Cámara ↗' : escapeHTML(label)}</strong></span></button>`;
}
