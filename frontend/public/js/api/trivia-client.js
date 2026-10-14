import { solicitarBackend } from './backend-client.js';


let estadoDiarioCache = null;


export function getCachedDailyTriviaStatus() {
    return estadoDiarioCache;
}


function guardarEstadoDiario(status) {
    estadoDiarioCache = status;
    return status;
}


function normalizarEstado(payload) {
    const status = {
        ...payload,
        date: payload.trivia_date,
        next_available_at: payload.next_available_at
    };

    if (payload.status === 'completed') {
        status.last_result = {
            attempt_id: payload.attempt_id,
            correct_count: payload.score,
            total_questions: payload.question_count,
            points_earned: payload.points_earned,
            points_balance: payload.points_balance,
            next_available_at: payload.next_available_at
        };
    }

    return status;
}


export async function getDailyTriviaStatus({ signal } = {}) {
    const payload = await solicitarBackend('/api/v1/trivia/daily', { signal });
    return guardarEstadoDiario(normalizarEstado(payload));
}


export async function startDailyTrivia({ signal } = {}) {
    return solicitarBackend('/api/v1/trivia/daily/start', {
        method: 'POST',
        signal
    });
}


export async function saveDailyTriviaAnswer(questionId, selectedOptionId, { signal } = {}) {
    return solicitarBackend(`/api/v1/trivia/daily/answers/${encodeURIComponent(questionId)}`, {
        method: 'PUT',
        body: { selected_option_id: selectedOptionId },
        signal
    });
}


export async function submitDailyTrivia({ signal } = {}) {
    const result = await solicitarBackend('/api/v1/trivia/daily/submit', {
        method: 'POST',
        signal
    });
    const normalized = {
        ...result,
        correct_count: result.score,
        total_questions: result.question_count
    };
    guardarEstadoDiario({
        status: 'completed',
        date: null,
        next_available_at: result.next_available_at,
        last_result: normalized
    });
    return normalized;
}
