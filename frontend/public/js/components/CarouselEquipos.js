export async function renderCarousel() {
    const container = document.getElementById('carrusel-container');
    if (!container) return;

    try {
        const response = await fetch('./data/equipos.json');
        const equipos = await response.json();

        container.classList.remove('animate-pulse', 'items-center', 'justify-center');
        container.classList.add('relative', 'overflow-hidden');

        let slidesHTML = '';
        equipos.forEach((equipo, index) => {
            slidesHTML += `
                <div
                    class="absolute inset-0 overflow-hidden rounded-b-[3rem]"
                    data-slide="${index}"
                    style="
                        background-color: ${equipo.colores.primario};
                        opacity: ${index === 0 ? 1 : 0};
                        z-index: ${index === 0 ? 1 : 0};
                        transition: opacity 0.65s ease, transform 0.65s ease;
                        transform: scale(${index === 0 ? 1 : 1.04});
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
                            src="${equipo.imagenes.logoFondo}"
                            alt="Logo ${equipo.nombre}"
                            class="w-full h-full object-contain drop-shadow-2xl"
                        >
                    </div>

                    <div class="absolute bottom-0 left-0 w-full h-[90%] flex justify-center items-end pointer-events-none z-20">
                        <img
                            src="${equipo.imagenes.jugadorCarrusel}"
                            alt="Jugador ${equipo.nombre}"
                            class="h-full object-contain object-bottom drop-shadow-2xl"
                            style="filter: drop-shadow(0 20px 40px rgba(0,0,0,0.6));"
                        >
                    </div>

                    <div class="absolute bottom-0 left-0 w-full h-[55%] bg-gradient-to-t from-black/90 via-black/50 to-transparent z-30 pointer-events-none rounded-b-[3rem]"></div>

                    <div class="absolute bottom-[18%] left-0 w-full flex flex-col items-end px-5 z-40 gap-1">
                        <div class="bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/20 shadow mb-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" class="flex-shrink-0" style="width:11px;height:11px;fill:white;">
                                <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z"/>
                            </svg>
                            <span class="text-white text-[11px] font-bold uppercase tracking-widest">${equipo.ciudad}</span>
                        </div>

                        <h2 class="text-[3.2rem] leading-none font-black text-white tracking-tight drop-shadow-2xl capitalize text-right"
                            style="text-shadow: 0 4px 20px rgba(0,0,0,0.8); font-family: 'Inter', system-ui, sans-serif;">
                            ${equipo.nombre}
                        </h2>

                        <button
                            class="mt-2 px-7 py-2 rounded-full font-bold text-sm border-0 cursor-pointer transition-transform active:scale-95"
                            style="background-color: ${equipo.colores.secundario}; color: ${equipo.colores.primario}; box-shadow: 0 4px 15px rgba(0,0,0,0.4); font-weight: 800;"
                            data-equipo-id="${equipo.id}"
                        >
                            Ver más
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = `
            <div id="carrusel-track" class="relative w-full h-full overflow-hidden rounded-b-[3rem]">
                ${slidesHTML}
            </div>
            <div id="carousel-dots" class="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-50 pointer-events-auto">
            </div>
        `;

        const track = document.getElementById('carrusel-track');
        const dotsContainer = document.getElementById('carousel-dots');
        const total = equipos.length;
        let current = 0;
        let autoPlayInterval = null;

        function renderDots(activeIndex) {
            if (!dotsContainer) return;
            dotsContainer.innerHTML = '';
            for (let i = 0; i < total; i++) {
                const wrapper = document.createElement('div');
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
                        goTo(i);
                        resetAutoPlay();
                    });
                }
                dotsContainer.appendChild(wrapper);
            }
        }

        function goTo(index) {
            const slides = track.querySelectorAll('[data-slide]');
            const prev = current;
            current = ((index % total) + total) % total;

            slides[prev].style.opacity = '0';
            slides[prev].style.transform = 'scale(1.04)';
            slides[prev].style.zIndex = '0';

            slides[current].style.transform = 'scale(1.04)';
            slides[current].style.zIndex = '1';
            slides[current].getBoundingClientRect();
            slides[current].style.opacity = '1';
            slides[current].style.transform = 'scale(1)';

            renderDots(current);
        }

        function startAutoPlay() {
            autoPlayInterval = setInterval(() => {
                goTo(current + 1);
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
        }, { passive: true });

        container.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;
            const diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 40) {
                goTo(diff > 0 ? current + 1 : current - 1);
            }
            startAutoPlay();
        }, { passive: true });

        renderDots(0);
        startAutoPlay();

    } catch (error) {
        console.error('Error al cargar los equipos:', error);
    }
}