// Local celebration without a CDN, render loop or pointer interception.
export function crearConfetiAR() {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let layer = null, animations = [];
    const limpiar = () => {
        animations.forEach(animation => animation.cancel()); animations = [];
        layer?.remove(); layer = null;
    };
    const suspender = () => { if (document.hidden) limpiar(); };
    const cambiar = () => { if (preference.matches) limpiar(); };
    document.addEventListener('visibilitychange', suspender);
    preference.addEventListener('change', cambiar);
    return {
        lanzar() {
            limpiar();
            if (preference.matches || document.hidden) return;
            const current = document.createElement('div');
            current.className = 'ar-confeti'; current.setAttribute('aria-hidden', 'true');
            const colors = ['#f27b21', '#008298', '#ffd45a', '#ffffff', '#49c595'];
            layer = current;
            for (let i = 0; i < 56; i++) {
                const particle = document.createElement('i');
                particle.style.backgroundColor = colors[i % colors.length]; current.append(particle);
                const x = innerWidth * .5, y = innerHeight * .32;
                const spread = (Math.random() - .5) * Math.min(innerWidth * 1.8, 950);
                const turn = (Math.random() - .5) * 1080;
                animations.push(particle.animate([
                    { transform: `translate(${x}px,${y}px) rotate(0deg)`, opacity: 1 },
                    { transform: `translate(${x + spread * .65}px,${y - 70 - Math.random() * 90}px) rotate(${turn * .4}deg)`, opacity: 1, offset: .3 },
                    { transform: `translate(${x + spread}px,${innerHeight * .85}px) rotate(${turn}deg)`, opacity: 0 },
                ], { duration: 1400 + Math.random() * 500, easing: 'cubic-bezier(.2,.6,.5,1)', fill: 'forwards' }));
            }
            document.body.append(current);
            void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
                current.remove(); if (layer === current) { layer = null; animations = []; }
            });
        },
        limpiar,
        destruir() {
            limpiar(); document.removeEventListener('visibilitychange', suspender);
            preference.removeEventListener('change', cambiar);
        },
    };
}
