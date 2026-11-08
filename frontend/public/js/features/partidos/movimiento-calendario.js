// Match the team page's reveal motion without hiding content before JS runs.
export function crearMovimientoCalendario(signal) {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pending = new Map(), active = new Map();
    let stopped = signal?.aborted === true;
    const canAnimate = () => !stopped && !preference.matches && !document.hidden;
    const animate = (element, frames, options) => {
        if (!canAnimate() || !element.isConnected || typeof element.animate !== 'function') return;
        active.get(element)?.cancel();
        const animation = element.animate(frames, { ...options, fill: 'none' });
        active.set(element, animation);
        animation.finished.catch(() => {}).finally(() => {
            if (active.get(element) === animation) active.delete(element);
        });
    };
    const reveal = (element, { delay = 0, distancia = 22 } = {}) => animate(element, [
        { opacity: 0, transform: `translateY(${distancia}px)` },
        { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 520, delay, easing: 'cubic-bezier(.2,.65,.3,1)' });
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const options = pending.get(entry.target);
            observer.unobserve(entry.target); pending.delete(entry.target);
            if (options) reveal(entry.target, options);
        }
    }, { threshold: .08 });
    const clear = container => {
        for (const element of pending.keys()) {
            if (!container || container.contains(element)) { observer?.unobserve(element); pending.delete(element); }
        }
        for (const [element, animation] of active) {
            if (!container || container.contains(element)) { animation.cancel(); active.delete(element); }
        }
    };
    const onPreference = () => { if (preference.matches) clear(); };
    const onVisibility = () => { if (document.hidden) clear(); };
    const stop = () => {
        if (stopped) return;
        stopped = true; clear(); observer?.disconnect();
        preference.removeEventListener('change', onPreference);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', stop);
    };
    if (!stopped) {
        preference.addEventListener('change', onPreference);
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pagehide', stop, { once: true });
        signal?.addEventListener('abort', stop, { once: true });
    }
    return {
        revelar(elements, { escalonar = true, distancia = 22 } = {}) {
            if (!canAnimate()) return;
            [...elements].forEach((element, index) => {
                if (!element?.isConnected || pending.has(element)) return;
                const options = { delay: escalonar ? Math.min(index, 4) * 35 : 0, distancia };
                if (observer) { pending.set(element, options); observer.observe(element); }
                else reveal(element, options);
            });
        },
        acentuar(element) {
            if (element) animate(element, [{ opacity: .45, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 200, easing: 'ease-out' });
        },
        limpiar: clear,
    };
}
