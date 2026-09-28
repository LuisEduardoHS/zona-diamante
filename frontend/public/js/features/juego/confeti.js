let capaActiva = null;
let animacionesActivas = [];

// Una sola lluvia a la vez para mantener ligero el escáner en celulares.
export function lanzarConfeti() {
    animacionesActivas.forEach((animacion) => animacion.cancel());
    capaActiva?.remove();

    const capa = document.createElement('div');
    capa.setAttribute('aria-hidden', 'true');
    capa.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden;';
    document.body.appendChild(capa);
    capaActiva = capa;

    const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colores = ['#f27b21', '#008298', '#ffd54a', '#ffffff', '#ed5b91', '#64d8cb'];
    const cantidad = movimientoReducido ? 18 : 110;
    const animaciones = [];

    for (let i = 0; i < cantidad; i++) {
        const pieza = document.createElement('span');
        const giro = Math.random() * 360;
        pieza.style.cssText = `position:absolute;left:${Math.random() * 100}%;top:${movimientoReducido ? 10 + Math.random() * 75 + '%' : '-20px'};width:${6 + Math.random() * 5}px;height:${9 + Math.random() * 7}px;background:${colores[i % colores.length]};border-radius:${i % 3 === 0 ? '50%' : '2px'};`;
        capa.appendChild(pieza);

        // Con movimiento reducido, las piezas aparecen y se desvanecen sin caer.
        const fotogramas = movimientoReducido
            ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }]
            : [
                { transform: `translate3d(0, -20px, 0) rotate(${giro}deg)`, opacity: 1 },
                { opacity: 1, offset: 0.75 },
                { transform: `translate3d(${Math.random() * 240 - 120}px, ${window.innerHeight + 60}px, 0) rotate(${giro + 540}deg)`, opacity: 0 }
            ];

        animaciones.push(pieza.animate(fotogramas, {
            duration: movimientoReducido ? 650 : 2200 + Math.random() * 900,
            delay: movimientoReducido ? 0 : Math.random() * 400,
            easing: 'linear',
            fill: 'both'
        }));
    }

    animacionesActivas = animaciones;
    Promise.allSettled(animaciones.map((animacion) => animacion.finished)).then(() => {
        capa.remove();
        if (capaActiva === capa) {
            capaActiva = null;
            animacionesActivas = [];
        }
    });
}
