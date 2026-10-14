export function crearEstadoTrivia() {
    return {
        status: 'loading',
        attempt: null,
        currentIndex: 0,
        answers: {},
        savingAnswer: false,
        saveError: null,
        result: null,
        error: null,
        nextAvailableAt: null
    };
}


function respuestasGuardadas(attempt) {
    return Object.fromEntries(
        attempt.questions
            .filter(question => question.selected_option_id)
            .map(question => [question.id, question.selected_option_id])
    );
}


function primeraPreguntaPendiente(attempt, answers) {
    const index = attempt.questions.findIndex(question => !answers[question.id]);
    return index === -1 ? Math.max(0, attempt.questions.length - 1) : index;
}


export function triviaReducer(state, action) {
    switch (action.type) {
        case 'SESSION_REQUIRED':
            return { ...crearEstadoTrivia(), status: 'guest' };
        case 'STATUS_AVAILABLE':
            return { ...crearEstadoTrivia(), status: 'available' };
        case 'STATUS_UNAVAILABLE':
            return { ...crearEstadoTrivia(), status: 'unavailable', nextAvailableAt: action.nextAvailableAt || null };
        case 'START': {
            const answers = respuestasGuardadas(action.attempt);
            return {
                ...crearEstadoTrivia(),
                status: 'in_progress',
                attempt: action.attempt,
                answers,
                currentIndex: primeraPreguntaPendiente(action.attempt, answers)
            };
        }
        case 'ANSWER_SAVING':
            return {
                ...state,
                savingAnswer: true,
                saveError: null,
                answers: { ...state.answers, [action.questionId]: action.optionId }
            };
        case 'ANSWER_SAVED':
            return { ...state, savingAnswer: false, saveError: null };
        case 'ANSWER_FAILED': {
            const answers = { ...state.answers };
            if (action.previousOptionId) answers[action.questionId] = action.previousOptionId;
            else delete answers[action.questionId];
            return {
                ...state,
                answers,
                savingAnswer: false,
                saveError: action.error || 'No pudimos guardar tu respuesta.'
            };
        }
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


export const todasRespondidas = state => Boolean(
    state.attempt?.questions.every(question => state.answers[question.id])
);
