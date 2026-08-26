export async function cargarDetalleEquipo() {
    const container = document.getElementById('equipo-detalle-container');
    if (!container) return;

    const parametros = new URLSearchParams(window.location.search);
    const equipoId = parametros.get('id');

    if (!equipoId) {
        container.innerHTML = `<h2 class="text-xl font-bold mt-10">Error: No se seleccionó ningún equipo.</h2>`;
        container.classList.remove('opacity-0');
        return;
    }

    try {

        const response = await fetch('./data/equipos.json');
        const equipos = await response.json();

        const equipo = equipos.find(eq => eq.id === equipoId);

        if (!equipo) {
            container.innerHTML = `<h2 class="text-xl font-bold mt-10">Error: Equipo no encontrado.</h2>`;
            container.classList.remove('opacity-0');
            return;
        }

        container.innerHTML = `
            <!-- BLOQUE 1: Hero (Fondo curvo y Título) -->
            <!-- Altura reducida a 210px y esquinas a 2rem -->
            <div class="absolute top-0 left-0 w-full h-[210px] rounded-b-[2rem] overflow-hidden -z-10" style="background-color: ${equipo.colores.primario};">
                
                <!-- Tu Curva SVG adaptada dinámicamente -->
                <div class="absolute top-0 left-0 w-[110%] -mt-4 pointer-events-none" style="color: ${equipo.colores.secundario};">
                    <svg class="fill-current w-full h-auto" viewBox="0 0 385 281" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M184.212 -251.171C465.464 -127.069 433.652 74.8564 193.908 111.096C-45.8354 147.335 -41.8832 283.396 -142.421 280.918C-242.959 278.44 -312.317 176.992 -239.468 86.9618C-181.189 14.9373 67.2685 -168.47 184.212 -251.171Z" fill="currentColor" fill-opacity="0.85"/>
                    </svg>
                </div>
                
                <!-- Nombre del Equipo (ajustado ligeramente hacia abajo para centrarse en el nuevo espacio) -->
                <div class="absolute bottom-5 right-6 w-full px-6 flex justify-end">
                    <h1 class="text-[2.1rem] leading-none font-monument text-white uppercase tracking-tighter drop-shadow-xl text-right">
                        ${equipo.nombre}
                    </h1>
                </div>
            </div>

            <!-- Espaciador invisible reducido para que la tarjeta gris suba -->
            <div class="w-full h-[130px]"></div>

            <!-- BLOQUE 2: Info Rápida (Zona, Récord, Posición) -->
            <div class="w-full bg-[#f0f0f3] rounded-[2rem] p-6 shadow-sm flex flex-col items-center gap-4 relative z-10 border border-white/50">
                
                <!-- Píldora de Zona -->
                <div class="bg-white text-sm font-extrabold rounded-full px-6 py-2 shadow-sm text-center" style="color: ${equipo.colores.primario};">
                    ${equipo.detalles.zona}
                </div>
                
                <!-- Fila de Récord y Posición -->
                <div class="flex items-center gap-4 w-full justify-center mt-2">
                    <span class="font-bold text-[#2b2b31] text-lg">Récord:</span>
                    
                    <!-- Píldora de Récord -->
                    <div class="bg-white font-black text-base rounded-full px-5 py-1.5 shadow-sm flex gap-1 items-center">
                        <span class="text-[#4CAF50]">${equipo.detalles.record.split('-')[0].trim()}</span> 
                        <span class="text-gray-400">-</span> 
                        <span class="text-[#F44336]">${equipo.detalles.record.split('-')[1].trim()}</span>
                    </div>
                    
                    <!-- Píldora de Posición -->
                    <div class="bg-white font-black text-base rounded-full px-5 py-1.5 shadow-sm" style="color: ${equipo.colores.secundario};">
                        ${equipo.detalles.posicion}
                    </div>
                </div>
            </div>

            <!-- Contenedor para los siguientes bloques -->
            <div id="resto-contenido" class="w-full flex flex-col gap-6 mt-6">
                <!-- Aquí inyectaremos lo demás -->
            </div>
        `;

        container.classList.remove('opacity-0');

        console.log("Detalle del equipo cargado correctamente:", equipo);

    } catch (error) {
        console.error("Error al cargar el detalle del equipo:", error);
        container.innerHTML = `<h2 class="text-xl font-bold mt-10 text-red-500">Error de conexión.</h2>`;
        container.classList.remove('opacity-0');
    }
}

cargarDetalleEquipo();