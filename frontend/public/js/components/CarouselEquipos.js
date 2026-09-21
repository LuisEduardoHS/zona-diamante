import { obtenerEquipos } from '../datos-equipos.js';
import { ruta } from '../rutas.js';

export async function renderCarousel(signal) {
    const container = document.getElementById('carrusel-container');
    if (!container) return;

    try {
        const equipos = await obtenerEquipos();
        if (signal?.aborted || !container.isConnected) return;

        container.classList.remove('animate-pulse', 'items-center', 'justify-center');
        container.classList.add('relative', 'overflow-hidden');

        let slidesHTML = '';
        equipos.forEach((equipo, index) => {
            slidesHTML += `
                <div
                    class="absolute inset-0 overflow-hidden rounded-b-[3rem]"
                    data-slide="${index}" ${index ? 'inert' : ''}
                    style="
                        background-color: ${equipo.colores.primario};
                        opacity: ${index === 0 ? 1 : 0};
                        z-index: ${index === 0 ? 1 : 0};
                        transform: ${index === 0 ? 'translateX(0)' : 'translateX(100%)'};
                        will-change: opacity, transform;
                    "
                >
                    <div class="absolute top-0 left-0 w-[95%] pointer-events-none" style="color: ${equipo.colores.secundario};">
                        <svg class="fill-current w-full h-auto" viewBox="0 0 385 281" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M184.212 -251.171C465.464 -127.069 433.652 74.8564 193.908 111.096C-45.8354 147.335 -41.8832 283.396 -142.421 280.918C-242.959 278.44 -312.317 176.992 -239.468 86.9618C-181.189 14.9373 67.2685 -168.47 184.212 -251.171Z" fill="currentColor" fill-opacity="0.85"/>
                        </svg>
                    </div>

                    <div class="absolute top-[5%] right-[-5%] w-[72%] h-[55%] flex items-center justify-center pointer-events-none z-10">
                        <img
                            ${index === 0 ? 'src' : 'data-src'}="${equipo.imagenes.logoFondo}"
                            alt="Logo ${equipo.nombre}" decoding="async"
                            class="w-full h-full object-contain drop-shadow-2xl"
                        >
                    </div>

                    <div class="absolute bottom-0 left-0 w-full h-[90%] flex justify-center items-end pointer-events-none z-20">
                        <img
                            ${index === 0 ? 'src' : 'data-src'}="${equipo.imagenes.jugadorCarrusel}"
                            alt="Jugador ${equipo.nombre}" decoding="async" fetchpriority="${index === 0 ? 'high' : 'low'}"
                            class="h-full object-contain object-bottom drop-shadow-2xl"
                            style="filter: drop-shadow(0 20px 40px rgba(0,0,0,0.6));"
                        >
                    </div>

                    <div class="absolute bottom-0 left-0 w-full h-[55%] bg-gradient-to-t from-black/90 via-black/50 to-transparent z-30 pointer-events-none rounded-b-[3rem]"></div>

                    <div class="carrusel-info absolute left-0 w-full flex flex-col items-end px-5 z-40 gap-1">
                        <div class="inline-flex items-center gap-2 mb-1 px-3 py-1 rounded-lg bg-[#2b2b31b8] text-white drop-shadow-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" class="block shrink-0" style="width:13px;height:13px;fill:white;">
                                <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z"/>
                            </svg>
                            <span class="text-white text-[11px] font-bold uppercase tracking-widest">${equipo.ciudad}</span>
                        </div>

                        <h2 class="text-3xl leading-none font-urbanist font-black text-white tracking-tight drop-shadow-2xl capitalize text-right"
                            style="text-shadow: 0 4px 30px rgba(0,0,0,0.8);">
                            ${equipo.nombre}
                        </h2>

                        <a
                            href="${ruta('equipo.html')}?id=${equipo.id}"
                            class="mt-2 px-7 py-2 rounded-full font-bold text-sm border-0 cursor-pointer transition-transform active:scale-95 inline-block text-center no-underline"
                            style="background-color: ${equipo.colores.secundario}; color: ${equipo.colores.primario}; font-weight: 800;"
                        >
                            Ver más
                        </a>
                    </div>
                </div>
            `;
        });

        container.innerHTML = `
            <div id="carrusel-track" class="relative w-full h-full overflow-hidden rounded-b-[3rem]">
                ${slidesHTML}
            </div>
            <div id="carousel-dots" class="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-[5] pointer-events-auto">
            </div>
        `;

        const track = document.getElementById('carrusel-track');
        const dotsContainer = document.getElementById('carousel-dots');
        const total = equipos.length;
        let current = 0;
        let autoPlayInterval = null;
        let animacionesSlides = [];

        function renderDots(activeIndex) {
            if (!dotsContainer) return;
            dotsContainer.innerHTML = '';
            for (let i = 0; i < total; i++) {
                const wrapper = document.createElement('button');
                wrapper.type = 'button';
                wrapper.setAttribute('aria-label', `Ver equipo ${equipos[i].nombre}`);
                wrapper.setAttribute('aria-pressed', String(i === activeIndex));
                wrapper.style.cssText = 'position:relative; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;';

                if (i === activeIndex) {
                    const halo = document.createElement('div');
                    halo.style.cssText = `
                        position: absolute;
                        width: 22px;
                        height: 22px;
                        border-radius: 50%;
                        background: rgba(255, 185, 30, 0.55);
                        transition: all 0.35s ease;
                    `;
                    const dot = document.createElement('div');
                    dot.style.cssText = `
                        position: relative;
                        width: 16px;
                        height: 16px;
                        border-radius: 50%;
                        background: #f27b21;
                        box-shadow: 0 2px 8px rgba(242,123,33,0.8);
                        transition: all 0.35s ease;
                        z-index: 1;
                    `;
                    wrapper.appendChild(halo);
                    wrapper.appendChild(dot);
                } else {
                    const dot = document.createElement('div');
                    dot.style.cssText = `
                        width: 16px;
                        height: 16px;
                        border-radius: 50%;
                        background: rgba(242, 123, 33, 0.5);
                        transition: all 0.35s ease;
                    `;
                    wrapper.appendChild(dot);
                    wrapper.addEventListener('click', () => {
                        goTo(i, i > current ? 1 : -1);
                        resetAutoPlay();
                    });
                }
                dotsContainer.appendChild(wrapper);
            }
        }

        function cargarSlide(index) {
            track.querySelectorAll(`[data-slide="${index % total}"] img[data-src]`).forEach(img => {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
        }

        function goTo(index, direccion = index > current ? 1 : -1) {
            const slides = track.querySelectorAll('[data-slide]');
            const prev = current;
            current = ((index % total) + total) % total;
            if (current === prev) return;
            animacionesSlides.forEach(animacion => animacion.cancel());
            animacionesSlides = [];

            slides.forEach((slide, indice) => {
                if (indice !== prev && indice !== current) {
                    slide.style.opacity = '0';
                    slide.style.zIndex = '0';
                }
            });

            cargarSlide(current);
            cargarSlide(current + 1);
            slides[prev].inert = true;
            slides[current].inert = false;
            slides[prev].style.opacity = '1';
            slides[prev].style.transform = 'translateX(0)';
            slides[prev].style.zIndex = '0';

            slides[current].style.opacity = '1';
            slides[current].style.transform = `translateX(${direccion * 100}%)`;
            slides[current].style.zIndex = '1';
            slides[current].getBoundingClientRect();
            const duracion = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 480;
            const animacionEntrante = slides[current].animate([
                { transform: `translateX(${direccion * 100}%)`, opacity: 1 },
                { transform: 'translateX(0)', opacity: 1 }
            ], { duration: duracion, easing: 'cubic-bezier(.22, .75, .25, 1)', fill: 'forwards' });
            animacionesSlides = [animacionEntrante];
            animacionEntrante.finished.then(() => {
                if (animacionesSlides[0] === animacionEntrante) {
                    slides[prev].style.opacity = '0';
                }
            }).catch(() => {});

            renderDots(current);
        }

        function startAutoPlay() {
            stopAutoPlay();
            if (signal?.aborted || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            autoPlayInterval = setInterval(() => {
                goTo(current + 1, 1);
            }, 4000);
        }

        function stopAutoPlay() {
            if (autoPlayInterval) {
                clearInterval(autoPlayInterval);
                autoPlayInterval = null;
            }
        }

        function resetAutoPlay() {
            stopAutoPlay();
            startAutoPlay();
        }

        let touchStartX = 0;
        let isDragging = false;

        container.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            isDragging = true;
            stopAutoPlay();
        }, { passive: true, signal });

        container.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;
            const diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 40) {
                goTo(diff > 0 ? current + 1 : current - 1, diff > 0 ? 1 : -1);
            }
            startAutoPlay();
        }, { passive: true, signal });

        renderDots(0);
        startAutoPlay();
        const anticipacion = setTimeout(() => cargarSlide(1), 1000);
        signal?.addEventListener('abort', () => { stopAutoPlay(); clearTimeout(anticipacion); }, { once: true });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stopAutoPlay(); else startAutoPlay();
        }, { signal });

    } catch (error) {
        if (!signal?.aborted && container.isConnected) {
            container.classList.remove('animate-pulse');
            container.textContent = 'No se pudieron cargar los equipos. Intenta recargar la página.';
        }
        console.error('Error al cargar los equipos:', error);
    }
}
