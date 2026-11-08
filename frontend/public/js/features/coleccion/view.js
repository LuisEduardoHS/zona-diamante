const labels = { team: 'Equipo', player: 'Jugador', mvp_player: 'MVP', mascot: 'Mascota' };
// Font Awesome Free v7.3.1, CC BY 4.0 — assets/icons/fontawesome/LICENSE.txt.
// Lock artwork supplied for the collection's blocked state.
const lockIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true" focusable="false"><path d="M256 160L256 224L384 224L384 160C384 124.7 355.3 96 320 96C284.7 96 256 124.7 256 160zM192 224L192 160C192 89.3 249.3 32 320 32C390.7 32 448 89.3 448 160L448 224C483.3 224 512 252.7 512 288L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 288C128 252.7 156.7 224 192 224z"/></svg>';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const collectionIcon = (name, base) => `<svg class="lucide-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="${escapeHTML(new URL('assets/icons/lucide.svg?v=20261108-secciones', base))}#${escapeHTML(name)}"></use></svg>`;
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
        ${!card.is_owned ? `<span class="col-card-lock" aria-hidden="true">${lockIcon}</span>` : ''}
    </div>`;
}
export function cardTile(card, team, base) {
    const label = card.is_owned ? 'Adquirida' : card.unlock_method === 'ar' ? 'Exclusiva AR' : `${card.cost.toLocaleString('es-MX')} pts`;
    return `<button type="button" class="col-tile ${card.is_owned ? 'col-tile--owned' : ''}" data-card="${card.id}" aria-label="${escapeHTML(card.name)}, ${card.is_owned ? '' : 'Bloqueada, '}${escapeHTML(label)}">
        ${cardFace(card,team,base)}<span class="col-tile-meta"><span>${card.is_owned ? `${collectionIcon('badge-check', base)} Adquirida` : card.unlock_method === 'ar' ? 'Exclusiva AR' : 'Desbloquear'}</span><strong>${card.is_owned ? 'En tu álbum' : card.unlock_method === 'ar' ? `Cámara ${collectionIcon('arrow-up-right', base)}` : escapeHTML(label)}</strong></span></button>`;
}
