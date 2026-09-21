// Adaptador para la versión local de MindAR: conserva su cámara y seguimiento.
// Su búsqueda normal usa recortes pequeños; esta segunda escala ve el logo entero.
export function detectarVistaAmplia(controller, input) {
    const { cropSize, detector } = controller.cropDetector;
    const lado = Math.min(controller.inputWidth, controller.inputHeight);
    const x = Math.floor((controller.inputWidth - lado) / 2);
    const y = Math.floor((controller.inputHeight - lado) / 2);
    const temporales = [];
    try {
        const recorte = input.slice([y, x], [lado, lado]);
        temporales.push(recorte);
        const canales = recorte.expandDims(2);
        temporales.push(canales);
        const reducido = canales.resizeBilinear([cropSize, cropSize], true);
        temporales.push(reducido);
        const plano = reducido.squeeze([2]);
        temporales.push(plano);
        const { featurePoints } = detector.detect(plano);
        const escala = (lado - 1) / (cropSize - 1);
        return featurePoints.map(punto => ({
            ...punto,
            x: x + punto.x * escala,
            y: y + punto.y * escala,
            scale: punto.scale * escala,
        }));
    } finally {
        temporales.reverse().forEach(tensor => tensor.dispose());
    }
}

const configurados = new WeakSet();
export function configurarDeteccionAmplia(controller) {
    if (!controller?.cropDetector?.detector || !controller._detectAndMatch || configurados.has(controller)) return;
    configurados.add(controller);
    const detectarOriginal = controller._detectAndMatch.bind(controller);
    let intentos = 0;
    let disponible = true;
    controller._detectAndMatch = async (input, indices) => {
        const resultado = await detectarOriginal(input, indices);
        if (resultado.targetIndex !== -1) {
            intentos = 0;
            return resultado;
        }
        // No añade trabajo mientras se sigue un logo ni en cada fotograma fallido.
        if (!disponible || !indices.length || ++intentos % 3 !== 0) return resultado;
        try {
            const puntos = detectarVistaAmplia(controller, input);
            return await controller._workerMatch(puntos, indices);
        } catch (error) {
            disponible = false;
            console.warn('Búsqueda amplia no disponible; continúa el detector normal.', error);
            return resultado;
        }
    };
}
