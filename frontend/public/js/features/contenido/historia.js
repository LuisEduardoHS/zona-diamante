export function iniciarHistoria(signal) {
    const app = document.getElementById('historia-app');
    if (!app || app.dataset.iniciada) return;
    app.dataset.iniciada = 'true';

    app.querySelector('a[href="#cronologia"]')?.addEventListener('click', event => {
        event.preventDefault();
        document.getElementById('cronologia')?.scrollIntoView({
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'start'
        });
    }, {signal});

    const revelar = new IntersectionObserver(entradas => entradas.forEach(entrada => {
        if (!entrada.isIntersecting) return;
        revelar.unobserve(entrada.target);
        entrada.target.classList.remove('opacity-0', 'translate-y-3');
        entrada.target.classList.add('opacity-100');
    }), { threshold: .12 });
    app.querySelectorAll('.historia-reveal').forEach(elemento => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches || elemento.getBoundingClientRect().top < innerHeight) return;
        elemento.classList.add('opacity-0', 'translate-y-3', 'transition', 'duration-500');
        revelar.observe(elemento);
    });
    signal?.addEventListener('abort', () => revelar.disconnect(), {once:true});

    app.querySelectorAll('.historia-filtro').forEach(boton => boton.addEventListener('click', () => {
        const era = boton.dataset.era;
        app.querySelectorAll('.historia-filtro').forEach(otro => {
            const activo = otro === boton;
            otro.setAttribute('aria-pressed', activo);
        });
        app.querySelectorAll('.historia-evento').forEach(evento => evento.classList.toggle('hidden', era !== 'todas' && evento.dataset.era !== era));
        const count=app.querySelectorAll('.historia-evento:not(.hidden)').length;
        app.querySelector('#historia-filter-status').textContent=`${count} ${count===1?'etapa':'etapas'}`;
    }, {signal}));
}
