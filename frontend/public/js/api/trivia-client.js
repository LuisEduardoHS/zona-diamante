// Adaptador temporal. La UI sólo conoce este contrato; al conectar FastAPI,
// estas funciones pueden conservar sus firmas y reemplazar únicamente el mock.
const CLAVE_RESULTADO = 'zona-diamante:trivia-diaria';
const ESPERA_MOCK = 450;
let estadoDiarioCache;

function claveEstadoDiario() {
    let resultadoGuardado;
    try { resultadoGuardado = localStorage.getItem(CLAVE_RESULTADO); } catch { resultadoGuardado = null; }
    return JSON.stringify([fechaLocal(), location.search, resultadoGuardado]);
}

// Caché de esta sesión de navegación; cambia al cambiar el día o el resultado
// guardado (incluidos los cambios realizados desde otra pestaña).
export function getCachedDailyTriviaStatus() {
    if (new URLSearchParams(location.search).get('triviaMock') === 'reset') return null;
    return estadoDiarioCache?.key === claveEstadoDiario() ? estadoDiarioCache.value : null;
}

function guardarEstadoDiario(value) {
    estadoDiarioCache = { key: claveEstadoDiario(), value };
    return value;
}

const BANCO_MOCK = [
    {
        id: 'mascota-dorados',
        text: '¿Cómo se llama la mascota de los Dorados de Chihuahua?',
        options: [
            { id: 'a', text: 'Tigre Toño' },
            { id: 'b', text: 'Lobo Mita' },
            { id: 'c', text: 'Pancho Pistolas' },
            { id: 'd', text: 'Sultán' }
        ],
        answer: 'c'
    },
    {
        id: 'entradas-beisbol',
        text: '¿Cuántas entradas tiene un juego profesional de béisbol?',
        options: [
            { id: 'a', text: 'Siete' },
            { id: 'b', text: 'Nueve' },
            { id: 'c', text: 'Diez' },
            { id: 'd', text: 'Doce' }
        ],
        answer: 'b'
    },
    {
        id: 'jugadores-campo',
        text: '¿Cuántos jugadores de un equipo están a la defensiva en el campo?',
        options: [
            { id: 'a', text: 'Siete' },
            { id: 'b', text: 'Ocho' },
            { id: 'c', text: 'Nueve' },
            { id: 'd', text: 'Once' }
        ],
        answer: 'c'
    },
    {
        id: 'home-run',
        text: '¿Cómo se llama el batazo que permite recorrer todas las bases?',
        options: [
            { id: 'a', text: 'Home run' },
            { id: 'b', text: 'Toque de bola' },
            { id: 'c', text: 'Ponche' },
            { id: 'd', text: 'Doble play' }
        ],
        answer: 'a'
    },
    {
        id: 'strikeout',
        text: '¿Cuántos strikes necesita un lanzador para ponchar a un bateador?',
        options: [
            { id: 'a', text: 'Dos' },
            { id: 'b', text: 'Tres' },
            { id: 'c', text: 'Cuatro' },
            { id: 'd', text: 'Cinco' }
        ],
        answer: 'b'
    }
];

const fechaLocal = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const siguienteDia = () => {
    const date = new Date();
    date.setHours(24, 0, 0, 0);
    return date.toISOString();
};

const esperar = (signal, ms = ESPERA_MOCK) => new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Operación cancelada', 'AbortError'));
    }, { once: true });
});

function leerResultado() {
    try {
        const value = JSON.parse(localStorage.getItem(CLAVE_RESULTADO));
        return value?.date === fechaLocal() ? value.result : null;
    } catch {
        return null;
    }
}

export async function getDailyTriviaStatus({ signal } = {}) {
    if (signal?.aborted) throw new DOMException('Operación cancelada', 'AbortError');
    const cached = getCachedDailyTriviaStatus();
    if (cached) return cached;
    await esperar(signal);
    const modo = new URLSearchParams(location.search).get('triviaMock');
    if (modo === 'error') throw new Error('Fallo simulado del servicio');
    if (modo === 'unavailable') return { status: 'unavailable', date: fechaLocal(), next_available_at: siguienteDia(), last_result: null };
    if (modo === 'reset') localStorage.removeItem(CLAVE_RESULTADO);
    const result = leerResultado();
    return guardarEstadoDiario({
        status: result ? 'completed' : 'available',
        date: fechaLocal(),
        next_available_at: result?.next_available_at || null,
        last_result: result
    });
}

export async function startDailyTrivia({ signal } = {}) {
    await esperar(signal, 300);
    if (leerResultado()) throw new Error('La trivia de hoy ya fue completada.');
    return {
        attempt_id: crypto.randomUUID?.() || `mock-${Date.now()}`,
        date: fechaLocal(),
        title: 'Trivia diaria',
        questions: BANCO_MOCK.map(({ id, text, options }) => ({
            id,
            text,
            options: options.map(option => ({ ...option }))
        }))
    };
}

export async function submitDailyTrivia(attemptId, answers, { signal } = {}) {
    await esperar(signal, 900);
    const previous = leerResultado();
    if (previous) return previous;
    const selected = new Map(answers.map(answer => [answer.question_id, answer.option_id]));
    const correctCount = BANCO_MOCK.filter(question => selected.get(question.id) === question.answer).length;
    // Valores de demostración devueltos por el adaptador, nunca calculados por la UI.
    // FastAPI reemplazará por completo esta evaluación y la recompensa.
    const pointsEarned = correctCount * 10;
    const result = {
        attempt_id: attemptId,
        correct_count: correctCount,
        total_questions: BANCO_MOCK.length,
        score: Math.round((correctCount / BANCO_MOCK.length) * 100),
        points_earned: pointsEarned,
        points_balance: 1170 + pointsEarned,
        completed_at: new Date().toISOString(),
        next_available_at: siguienteDia()
    };
    localStorage.setItem(CLAVE_RESULTADO, JSON.stringify({ date: fechaLocal(), result }));
    guardarEstadoDiario({
        status: 'completed', date: fechaLocal(),
        next_available_at: result.next_available_at, last_result: result
    });
    return result;
}
