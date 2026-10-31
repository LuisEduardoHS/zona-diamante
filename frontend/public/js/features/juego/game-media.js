export function validateArt(manifest) {
    if (!manifest?.canvas || !Number.isFinite(manifest.canvas.width) || !Number.isFinite(manifest.canvas.height)
        || manifest.canvas.width <= 0 || manifest.canvas.height <= 0 || manifest.frames?.length !== 4) throw new Error('Manifiesto de arte inválido.');
    for (const frame of manifest.frames) if (typeof frame.src !== 'string' || !Number.isFinite(frame.offsetX) || !Number.isFinite(frame.offsetY)) throw new Error('Fotograma inválido.');
    const a = manifest.animation;
    if (!a || !(a.anticipateMs > 0 && a.loadUntilMs > 0 && a.loadUntilMs < a.swingUntilMs && a.swingUntilMs < a.followUntilMs)) throw new Error('Animación inválida.');
    return manifest;
}
export function frameFor(state, manifest) {
    const phase = state.phase === 'paused' ? state.pausedFrom : state.phase;
    const a = manifest.animation;
    if (phase === 'pitch') return state.elapsed >= state.plan.contactMs - a.anticipateMs ? 1 : 0;
    if (phase !== 'feedback' || state.last?.type === 'no_swing') return 0;
    return state.elapsed < a.loadUntilMs ? 1 : state.elapsed < a.swingUntilMs ? 2 : state.elapsed < a.followUntilMs ? 3 : 0;
}
export function spriteTransform(frame, canvas) {
    return `translate(${frame.offsetX / canvas.width * 100}%, ${frame.offsetY / canvas.height * 100}%)`;
}
export async function preloadSprites(manifest, { base, signal, ImageClass = Image, timeout = 5000 } = {}) {
    validateArt(manifest);
    return Promise.all(manifest.frames.map(frame => new Promise(resolve => {
        const img = new ImageClass(); let done = false, timer;
        const finish = available => {
            if (done) return; done = true; clearTimeout(timer); img.onload = null; img.onerror = null;
            signal?.removeEventListener('abort',abort);
            resolve({ ...frame, url:available ? img.src : '', available });
        };
        const abort = () => finish(false);
        if (signal?.aborted) { finish(false); return; }
        signal?.addEventListener('abort',abort,{once:true});
        img.onload = () => finish(true); img.onerror = () => finish(false);
        timer = setTimeout(() => finish(false),timeout);
        try { const url = new URL(frame.src,base); if (!['https:','http:'].includes(url.protocol)) throw new Error('Unsafe asset URL'); img.src = url.href; }
        catch { finish(false); }
    })));
}
export function usableFrame(index, sprites) {
    return sprites[index]?.available ? index : sprites.findIndex(frame => frame.available);
}
// The shared foot anchor is centered on home plate; contact sits on the bat arc.
export const CONTACT = Object.freeze({x:.43,y:.37});
export function contactCue(state) {
    if (state.phase !== 'pitch' || !state.plan) return 'waiting';
    const distance = state.elapsed - state.plan.contactMs;
    return distance < -state.plan.validWindowMs ? 'early' : distance > state.plan.validWindowMs ? 'late' : 'contact';
}
export function ballPosition(state) {
    const phase = state.phase === 'paused' ? state.pausedFrom : state.phase;
    if (!['pitch','feedback'].includes(phase) || !state.plan) return {visible:false,x:0,y:0,scale:0};
    if (phase === 'feedback' && ['hit','perfect'].includes(state.last.type)) {
        const p = Math.min(1,state.elapsed / state.last.duration);
        return {visible:p < .92,x:CONTACT.x + .38*p,y:CONTACT.y - .51*Math.sin(p*Math.PI/2),scale:1.15 - p*.85};
    }
    const elapsed = phase === 'feedback' ? state.last.at + state.elapsed : state.elapsed;
    const p = Math.max(0,elapsed / state.plan.contactMs), t = Math.min(1,p);
    return {visible:elapsed <= state.plan.flightMs,x:.67 + (CONTACT.x - .67)*t + (p > 1 ? -.1*(p-1) : 0),
        y:.23 + (CONTACT.y - .23)*t*t + (p > 1 ? .5*(p-1) : 0),scale:.45 + Math.min(p,1.2)*.85};
}
