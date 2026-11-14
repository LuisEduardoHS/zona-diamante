const recetas = {
    original: { nombre: 'Original', pasos: [] },
    naranja: { nombre: 'Naranja', pasos: [['sepia', .42], ['saturate', 1.65], ['hue-rotate', -12], ['contrast', 1.06]] },
    pastel: { nombre: 'Pastel', pasos: [['contrast', .82], ['saturate', .72], ['brightness', 1.09]] },
    cine: { nombre: 'Cine', pasos: [['contrast', 1.18], ['saturate', .8], ['brightness', .95]] },
    calido: { nombre: 'Cálido', pasos: [['sepia', .3], ['saturate', 1.35]] },
    retro: { nombre: 'Retro', pasos: [['sepia', .6], ['contrast', .9], ['saturate', .8]] },
};
const numero = value => String(Number(value.toFixed(5)));
const pasoCSS = (nombre, valor) => `${nombre}(${numero(valor)}${nombre === 'hue-rotate' ? 'deg' : ''})`;
export const FILTROS_VIDEO = Object.freeze(Object.fromEntries(Object.entries(recetas).map(([key, value]) => [key,
    Object.freeze({ ...value, pasos: Object.freeze(value.pasos.map(paso => Object.freeze(paso))), css: value.pasos.map(([nombre, valor]) => pasoCSS(nombre, valor)).join(' ') || 'none' }),
])));
export const AJUSTES_VIDEO = Object.freeze({ filtro: 'original', intensidad: 100, brillo: 0, contraste: 0, saturacion: 0, temperatura: 0 });
export const HERRAMIENTAS_VIDEO = Object.freeze({ brillo: 'Brillo', contraste: 'Contraste', saturacion: 'Saturación', temperatura: 'Temperatura' });
const limitar = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : 0));

export function normalizarVideo(value = {}) {
    return { filtro: Object.hasOwn(FILTROS_VIDEO, value.filtro) ? value.filtro : 'original',
        intensidad: limitar(value.intensidad ?? 100, 0, 100),
        ...Object.fromEntries(Object.keys(HERRAMIENTAS_VIDEO).map(key => [key, limitar(value[key] ?? 0, -100, 100)])) };
}

// Each render starts from the original player; adjustments never accumulate.
export function filtroCSSVideo(value = {}) {
    const p = normalizarVideo(value), intensidad = p.intensidad / 100;
    const pasos = FILTROS_VIDEO[p.filtro].pasos.map(([nombre, valor]) => {
        const identidad = ['sepia', 'grayscale', 'hue-rotate'].includes(nombre) ? 0 : 1;
        return [nombre, identidad + (valor - identidad) * intensidad];
    }).filter(([nombre, valor]) => Math.abs(valor - (['sepia', 'grayscale', 'hue-rotate'].includes(nombre) ? 0 : 1)) > .00001);
    for (const [key, nombre] of [['brillo', 'brightness'], ['contraste', 'contrast'], ['saturacion', 'saturate']]) {
        if (p[key]) pasos.push([nombre, 1 + p[key] / 100]);
    }
    const css = pasos.map(([nombre, valor]) => pasoCSS(nombre, valor));
    return css.join(' ') || 'none';
}

// A soft-light tint also works on cross-origin video players, without reading frames.
export function temperaturaVideo(value = 0) {
    const temperatura = limitar(value, -100, 100);
    return { color: temperatura >= 0 ? '#ff914b' : '#4696ff', opacidad: Number((Math.abs(temperatura) / 100 * .55).toFixed(5)) };
}
