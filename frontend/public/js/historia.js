export function iniciarHistoria() {
    const app = document.getElementById('historia-app');
    if (!app || app.dataset.iniciada) return;
    app.dataset.iniciada = 'true';

    app.querySelector('a[href="#cronologia"]')?.addEventListener('click', event => {
        event.preventDefault();
        document.getElementById('cronologia')?.scrollIntoView({
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'start'
        });
    });

    const revelar = new IntersectionObserver(entradas => entradas.forEach(entrada => {
        if (!entrada.isIntersecting) return;
        revelar.unobserve(entrada.target);
        entrada.target.classList.remove('opacity-0', 'translate-y-5');
        entrada.target.classList.add('opacity-100');
    }), { threshold: .12 });
    app.querySelectorAll('.historia-reveal').forEach((elemento, indice) => {
        elemento.classList.add('opacity-0', 'translate-y-5', 'transition', 'duration-700');
        elemento.style.transitionDelay = `${Math.min(indice * 45, 240)}ms`;
        revelar.observe(elemento);
    });

    app.querySelectorAll('.historia-filtro').forEach(boton => boton.addEventListener('click', () => {
        const era = boton.dataset.era;
        app.querySelectorAll('.historia-filtro').forEach(otro => {
            const activo = otro === boton;
            otro.setAttribute('aria-selected', activo);
        });
        app.querySelectorAll('.historia-evento').forEach(evento => evento.classList.toggle('hidden', era !== 'todas' && evento.dataset.era !== era));
    }));
}
