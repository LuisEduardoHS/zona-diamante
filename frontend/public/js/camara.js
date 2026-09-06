document.addEventListener('DOMContentLoaded', () => {
    const equiposAR = {
        0: "Algonoderos",
        1: "Charros",
        2: "Dorados",
        3: "Sultanes"
    };

    const uiResult = document.getElementById('ar-result');
    const uiStatus = document.getElementById('ar-status');
    const textoEquipo = document.getElementById('equipo-detectado');

    const mostrarResultado = (index) => {
        const nombreEquipo = equiposAR[index];
        textoEquipo.textContent = nombreEquipo;
        uiStatus.textContent = "¡Escaneo Exitoso!";
        uiStatus.parentElement.classList.replace('bg-black/50', 'bg-green-500/80');

        uiResult.classList.remove('hidden');
        uiResult.classList.add('flex');

        setTimeout(() => {
            uiResult.classList.remove('translate-y-10', 'opacity-0');
        }, 10);
    };

    const ocultarResultado = () => {
        uiStatus.textContent = "Escaneando logo...";
        uiStatus.parentElement.classList.replace('bg-green-500/80', 'bg-black/50');

        uiResult.classList.add('translate-y-10', 'opacity-0');

        setTimeout(() => {
            uiResult.classList.add('hidden');
            uiResult.classList.remove('flex');
        }, 300);
    };

    for (let i = 0; i <= 3; i++) {
        const target = document.getElementById(`target-${i}`);
        if (target) {
            target.addEventListener('targetFound', () => mostrarResultado(i));
            target.addEventListener('targetLost', () => ocultarResultado());
        }
    }
})