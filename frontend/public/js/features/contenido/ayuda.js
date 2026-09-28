function normalizar(texto) {
    return texto.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function iniciarAyuda() {
    const app = document.getElementById('ayuda-app');
    if (!app || app.dataset.iniciada === 'true') return;
    app.dataset.iniciada = 'true';
    const busqueda = document.getElementById('ayuda-busqueda');
    const limpiar = document.getElementById('ayuda-limpiar');
    const sinResultados = document.getElementById('ayuda-sin-resultados');
    const preguntas = [...app.querySelectorAll('.ayuda-pregunta')];
    let filtro = 'todas';

    const actualizar = () => {
        const termino = normalizar(busqueda.value.trim());
        let visibles = 0;
        preguntas.forEach(pregunta => {
            const coincideTema = filtro === 'todas' || pregunta.dataset.tema === filtro;
            const coincideTexto = !termino || normalizar(pregunta.textContent).includes(termino);
            const visible = coincideTema && coincideTexto;
            pregunta.classList.toggle('hidden', !visible);
            if (visible) visibles += 1;
        });
        limpiar.classList.toggle('hidden', !busqueda.value);
        sinResultados.classList.toggle('hidden', visibles > 0);
    };

    busqueda.addEventListener('input', actualizar);
    limpiar.addEventListener('click', () => { busqueda.value = ''; busqueda.focus(); actualizar(); });
    app.querySelectorAll('.ayuda-filtro').forEach(boton => boton.addEventListener('click', () => {
        filtro = boton.dataset.filtro;
        app.querySelectorAll('.ayuda-filtro').forEach(otro => {
            const activo = otro === boton;
            otro.setAttribute('aria-pressed', String(activo));
            otro.classList.toggle('bg-[#2b2b31]', activo);
            otro.classList.toggle('text-white', activo);
            otro.classList.toggle('bg-white', !activo);
        });
        actualizar();
    }));
    document.getElementById('ayuda-formulario')?.addEventListener('submit', event => {
        event.preventDefault();
        event.currentTarget.reset();
        document.getElementById('ayuda-confirmacion').classList.remove('hidden');
    });
}