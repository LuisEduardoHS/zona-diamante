export function iniciarHistoria(signal) {
    const app = document.getElementById('historia-app');
    if (!app || app.dataset.iniciada || signal?.aborted) return;
    app.dataset.iniciada = 'true';

    app.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
        const target = app.querySelector(link.getAttribute('href'));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'start'
        });
    }, {signal}));

    const tabs = [...app.querySelectorAll('[data-info-league]')];
    const selectLeague = tab => {
        tabs.forEach(other => {
            const selected = other === tab;
            other.setAttribute('aria-selected', String(selected));
            other.tabIndex = selected ? 0 : -1;
            app.querySelector('#' + other.getAttribute('aria-controls')).hidden = !selected;
        });
    };
    tabs.forEach((tab,index) => {
        tab.addEventListener('click', () => selectLeague(tab), {signal});
        tab.addEventListener('keydown', event => {
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1
                : event.key === 'ArrowRight' ? (index+1)%tabs.length
                : event.key === 'ArrowLeft' ? (index+tabs.length-1)%tabs.length : null;
            if (next === null) return;
            event.preventDefault(); selectLeague(tabs[next]); tabs[next].focus();
        }, {signal});
    });

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
