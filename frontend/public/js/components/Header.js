export function renderHeader() {
    const headerHTML =`
        <header class="absolute top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-5">
            <button id="btn-abrir-menu" class="w-12 h-12 rounded-full bg-[#f27b21] flex items-center justify-center shadow-md transition-transform hover:scale-105">
                <svg width="18" height="16" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect y="4" width="4" height="20" rx="2" transform="rotate(-90 0 4)" fill="white"/>
                    <rect y="11" width="4" height="20" rx="2" transform="rotate(-90 0 11)" fill="white"/>
                    <rect y="18" width="4" height="20" rx="2" transform="rotate(-90 0 18)" fill="white"/>
                </svg>
            </button>

            <button class="w-12 h-12 rounded-full bg-[#c8c8c8] flex items-center justify-center shadow-md transition-transform hover:scale-105">
                <svg class="w-8 h-8" viewBox="0 0 41 37" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24.4351 11H16.4351L14.9351 12.5L20.4351 19L25.9351 12.5L24.4351 11Z" fill="#2B2B31" stroke="#2B2B31" stroke-width="22"/>
                </svg>
            </button>
        </header>

        <div id="menu-overlay" class="fixed inset-0 z-[60] bg-gradient-to-b from-[#a64010]/40 to-[#1b434b]/50 backdrop-blur-md flex flex-col opacity-0 pointer-events-none transition-opacity duration-500 ease-in-out">
            <div class="absolute top-5 left-6">
                <button id="btn-cerrar-menu" class="w-12 h-12 rounded-full bg-white flex items-center shadow-md transition-transform hover:scale-105 p-0">
                    <svg class="w-6 h-6 text-[#f27b21] m-auto" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <nav class="flex flex-col items-center justify-center w-3/4 h-full mx-auto mt-8">
                <a href="index.html" class="menu-item transform -translate-y-10 opacity-0 transition-all duration-500 delay-[100ms] w-full text-center text-white font-bold text-3xl py-5 border-b-[1.5px] border-white/30 hover:text-[#f27b21]">Inicio</a>
                <a href="partidos.html" class="menu-item transform -translate-y-10 opacity-0 transition-all duration-500 delay-[200ms] w-full text-center text-white font-bold text-3xl py-5 border-b-[1.5px] border-white/30 hover:text-[#f27b21]">Partidos</a>
                <a href="trivia.html" class="menu-item transform -translate-y-10 opacity-0 transition-all duration-500 delay-[300ms] w-full text-center text-white font-bold text-3xl py-5 border-b-[1.5px] border-white/30 hover:text-[#f27b21]">Trivia</a>
                <a href="info.html" class="menu-item transform -translate-y-10 opacity-0 transition-all duration-500 delay-[400ms] w-full text-center text-white font-bold text-3xl py-5 border-b-[1.5px] border-white/30 hover:text-[#f27b21]">Info</a>
            </nav>
        </div>
    `;

    const contenedor = document.getElementById('header-superior');
    if (contenedor) {
        contenedor.innerHTML = headerHTML;

        const btnAbrir = document.getElementById('btn-abrir-menu');
        const btnCerrar = document.getElementById('btn-cerrar-menu');
        const menuOverlay = document.getElementById('menu-overlay');
        const menuItems = document.querySelectorAll('.menu-item');

        btnAbrir.addEventListener('click', () => {
            menuOverlay.classList.remove('opacity-0', 'pointer-events-none');
            menuOverlay.classList.add('opacity-100', 'pointer-events-auto');
            menuItems.forEach(items => {
                items.classList.remove('-translate-y-10', 'opacity-0');
                items.classList.add('translate-y-0', 'opacity-100');
            });
        });

        btnCerrar.addEventListener('click', () => {
            menuOverlay.classList.remove('opacity-100', 'pointer-events-auto');
            menuOverlay.classList.add('opacity-0', 'pointer-events-none');
            menuItems.forEach(items => {
                items.classList.remove('translate-y-0', 'opacity-100');
                items.classList.add('-translate-y-10', 'opacity-0');
            });
        });
    }
}