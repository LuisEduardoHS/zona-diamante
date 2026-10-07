export function crearEstadoTrivia() {
    return {
        status: 'loading',
        attempt: null,
        currentIndex: 0,
        answers: {},
        result: null,
        error: null,
        nextAvailableAt: null
    };
}

export function triviaReducer(state, action) {
    switch (action.type) {
        case 'STATUS_AVAILABLE':
            return { ...crearEstadoTrivia(), status: 'available' };
        case 'STATUS_UNAVAILABLE':
            return { ...crearEstadoTrivia(), status: 'unavailable', nextAvailableAt: action.nextAvailableAt || null };
        case 'START':
            return { ...crearEstadoTrivia(), status: 'in_progress', attempt: action.attempt };
        case 'ANSWER':
            return {
                ...state,
                answers: { ...state.answers, [action.questionId]: action.optionId }
            };
        case 'GO_TO':
            return {
                ...state,
                currentIndex: Math.max(0, Math.min(action.index, state.attempt.questions.length - 1))
            };
        case 'SUBMITTING':
            return { ...state, status: 'submitting', error: null };
        case 'COMPLETED':
            return { ...state, status: 'completed', result: action.result, nextAvailableAt: action.result.next_available_at };
        case 'ERROR':
            return { ...state, status: 'error', error: action.error || 'No pudimos cargar la trivia.' };
        default:
            return state;
    }
}

export const respuestaActual = state => {
    const question = state.attempt?.questions[state.currentIndex];
    return question ? state.answers[question.id] : null;
};

export const respuestasParaEnvio = state => state.attempt.questions.map(question => ({
    question_id: question.id,
    option_id: state.answers[question.id]
}));
