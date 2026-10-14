import { getDailyTriviaStatus, saveDailyTriviaAnswer, startDailyTrivia, submitDailyTrivia } from '../../api/trivia-client.js';
import { RUTAS, ruta } from '../../app/rutas.js';
import { crearEstadoTrivia, respuestaActual, todasRespondidas, triviaReducer } from './trivia-state.js';


const escapeHTML = value => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));

let closedResultId;
const resultId = result => result.attempt_id || result.next_available_at;

const localDateValue = date => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
].join('-');

function calendarTemplate(today = new Date()) {
    const month = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(today);
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() + index - 3);
        const current = index === 3;
        return `<time class="calendar-day${current ? ' is-today' : ''}" datetime="${localDateValue(date)}"${current ? ' aria-current="date"' : ''}>
            <span class="sr-only">${new Intl.DateTimeFormat('es-MX', { weekday: 'narrow' }).format(date)}</span>
            <strong>${date.getDate()}</strong>
        </time>`;
    }).join('');
    return `<div class="trivia-calendar" aria-label="Semana actual">
        <p>${escapeHTML(month)}</p>
        <div class="calendar-days">${days}</div>
    </div>`;
}

const icono = (symbol, label = '') => `<span class="trivia-icon" aria-hidden="true">${symbol}</span>${label ? `<span class="sr-only">${escapeHTML(label)}</span>` : ''}`;

function loadingTemplate(label = 'Cargando reto del día...') {
    return `<div class="trivia-loading" role="status">
        <span class="skeleton skeleton-badge"></span><span class="skeleton skeleton-title"></span>
        <span class="skeleton skeleton-copy"></span><span class="skeleton skeleton-button"></span>
        <span class="sr-only">${escapeHTML(label)}</span>
    </div>`;
}

function availableTemplate(completed = false) {
    return `<div class="trivia-screen trivia-cover">
        ${calendarTemplate()}
        <div class="trivia-cover-title">
            <h1 id="trivia-title" tabindex="-1">Trivia</h1>
            <p>Reto del día</p>
        </div>
        <div class="trivia-art-placeholder" aria-hidden="true"></div>
        ${completed
            ? '<div class="trivia-start trivia-next-challenge"><span>Próxima trivia en</span><strong id="trivia-countdown" role="timer" aria-live="off">--:--:--</strong></div>'
            : '<button class="trivia-button trivia-start" id="start-trivia" type="button">Iniciar</button>'}
    </div>`;
}

function questionTemplate(state) {
    const { questions } = state.attempt;
    const question = questions[state.currentIndex];
    const selected = respuestaActual(state);
    const last = state.currentIndex === questions.length - 1;
    return `<div class="trivia-screen trivia-game">
        <div class="trivia-progress-row" role="status" aria-live="polite">
            <strong>Pregunta ${state.currentIndex + 1} de ${questions.length}</strong>
            <span>${state.savingAnswer ? 'Guardando…' : 'Elige una respuesta'}</span>
        </div>
        <section class="question-card" aria-labelledby="question-text">
            <div class="question-image">
                <img src="${ruta('assets/img/trivia/baseball-field.webp')}" alt="" aria-hidden="true">
                <div class="question-overlay"></div>
                <h2 id="question-text">${escapeHTML(question.text)}</h2>
            </div>
            <span class="question-position">${state.currentIndex + 1} / ${questions.length}</span>
        </section>
        <div class="answers" role="group" aria-labelledby="question-text">
            ${question.options.map(option => `<button class="answer${selected === option.id ? ' selected' : ''}" type="button" data-option-id="${escapeHTML(option.id)}" aria-pressed="${selected === option.id}"${state.savingAnswer ? ' disabled' : ''}>${escapeHTML(option.text)}</button>`).join('')}
            ${state.saveError ? `<p class="trivia-save-error" role="alert">${escapeHTML(state.saveError)}</p>` : ''}
        </div>
        ${last ? `<dialog class="trivia-dialog" id="submit-dialog" aria-labelledby="submit-title">
            <div class="trivia-dialog-content">
                <h2 id="submit-title">¿Enviar tus respuestas?</h2>
                <p>Una vez enviada la trivia, se calculará tu resultado.</p>
                <div class="trivia-dialog-actions">
                    <button class="trivia-button trivia-button--secondary" id="cancel-submit" type="button">Cancelar</button>
                    <button class="trivia-button" id="confirm-submit" type="button">Enviar trivia</button>
                </div>
            </div>
        </dialog>` : ''}
    </div>`;
}

function submittingTemplate() {
    return `<div class="trivia-screen trivia-screen--center"><div role="status">
        <div class="trivia-spinner" aria-hidden="true"></div>
        <h2>Validando tus respuestas...</h2>
        <p class="trivia-copy">Estamos preparando tu resultado. Esto tomará sólo un momento.</p>
    </div></div>`;
}

function completedTemplate(result) {
    return `<div class="trivia-screen trivia-screen--center trivia-completed"><div>
        <button class="trivia-close-result" id="close-trivia-result" type="button" aria-label="Cerrar resultados"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
        <span class="trivia-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor"><path d="M530.8 134.1C545.1 144.5 548.3 164.5 537.9 178.8L281.9 530.8C276.4 538.4 267.9 543.1 258.5 543.9C249.1 544.7 240 541.2 233.4 534.6L105.4 406.6C92.9 394.1 92.9 373.8 105.4 361.3C117.9 348.8 138.2 348.8 150.7 361.3L252.2 462.8L486.2 141.1C496.6 126.8 516.6 123.6 530.9 134z"/></svg></span>
        <h2>¡Reto completado!</h2>
        <div class="trivia-result">
            <div class="trivia-stat"><strong>${Number(result.correct_count)} / ${Number(result.total_questions)}</strong>respuestas correctas</div>
            <div class="trivia-stat"><strong>+${Number(result.points_earned)}</strong>puntos ganados</div>
        </div>
        ${Number.isFinite(Number(result.points_balance)) ? `<p class="trivia-balance">Balance: <strong>${Number(result.points_balance)} puntos</strong></p>` : ''}
        <p class="trivia-countdown">Nueva trivia en:<strong id="trivia-countdown">--:--:--</strong></p>
        <div class="trivia-complete-actions">
            <a class="trivia-button trivia-button--link" href="${ruta(RUTAS.coleccion)}">Mi colección</a>
        </div>
    </div></div>`;
}

function unavailableTemplate() {
    return `<div class="trivia-screen trivia-screen--center"><div>
        ${icono('◇', 'Sin trivia disponible')}
        <h2>La trivia de hoy todavía no está disponible</h2>
        <p class="trivia-copy">Inténtalo de nuevo más tarde.</p>
        <button class="trivia-button trivia-button--secondary" id="retry-trivia" type="button">Reintentar</button>
    </div></div>`;
}

function errorTemplate(message) {
    return `<div class="trivia-screen trivia-screen--center"><div>
        ${icono('!', 'Error')}
        <h2>No pudimos cargar la trivia</h2>
        <p class="trivia-copy">${escapeHTML(message || 'Revisa tu conexión e inténtalo de nuevo.')}</p>
        <button class="trivia-button" id="retry-trivia" type="button">Reintentar</button>
    </div></div>`;
}

export function iniciarTrivia(signal) {
    const view = document.getElementById('trivia-view');
    if (!view) return;

    let state = crearEstadoTrivia();
    let displayedDay = localDateValue(new Date());
    let countdownTimer;

    const setState = action => {
        state = triviaReducer(state, action);
        render();
    };

    const startCountdown = target => {
        clearInterval(countdownTimer);
        const output = document.getElementById('trivia-countdown');
        if (!output || !target) return;
        const update = () => {
            const remaining = Math.max(0, new Date(target).getTime() - Date.now());
            const hours = String(Math.floor(remaining / 3600000)).padStart(2, '0');
            const minutes = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0');
            const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
            output.textContent = `${hours}:${minutes}:${seconds}`;
        };
        update();
        countdownTimer = setInterval(update, 1000);
    };

    const openSubmitDialog = () => {
        document.getElementById('submit-dialog')?.showModal();
        const app = document.getElementById('trivia-app');
        if (app) app.scrollTop = 0;
    };

    const advanceQuestion = () => {
        if (state.status !== 'in_progress') return;
        const last = state.currentIndex === state.attempt.questions.length - 1;
        if (last) openSubmitDialog();
        else setState({ type: 'GO_TO', index: state.currentIndex + 1 });
    };

    const render = () => {
        clearInterval(countdownTimer);
        const app = document.getElementById('trivia-app');
        app?.setAttribute('data-status', state.status);
        view.setAttribute('aria-busy', String(['loading', 'submitting'].includes(state.status)));
        const templates = {
            loading: () => loadingTemplate(),
            available: availableTemplate,
            in_progress: () => questionTemplate(state),
            submitting: submittingTemplate,
            completed: () => closedResultId === resultId(state.result) ? availableTemplate(true) : completedTemplate(state.result),
            unavailable: unavailableTemplate,
            error: () => errorTemplate(state.error)
        };
        view.innerHTML = (templates[state.status] || errorTemplate)();
        if (app) app.scrollTop = 0;
        view.querySelector('#submit-dialog')?.addEventListener('close', () => {
            if (app) app.scrollTop = 0;
        });
        if (state.status === 'completed') startCountdown(state.nextAvailableAt);
    };

    const applyStatus = async status => {
        if (status.status === 'completed' && status.last_result) {
            setState({ type: 'COMPLETED', result: status.last_result });
        } else if (status.status === 'in_progress') {
            const attempt = await startDailyTrivia({ signal });
            if (!signal.aborted) setState({ type: 'START', attempt });
        } else if (status.status === 'available') {
            setState({ type: 'STATUS_AVAILABLE' });
        } else {
            setState({ type: 'STATUS_UNAVAILABLE', nextAvailableAt: status.next_available_at });
        }
    };

    const loadStatus = async () => {
        displayedDay = localDateValue(new Date());
        state = crearEstadoTrivia();
        render();
        try {
            const status = await getDailyTriviaStatus({ signal });
            if (!signal.aborted) await applyStatus(status);
        } catch (error) {
            if (error.name !== 'AbortError') setState({ type: 'ERROR', error: error.message });
        }
    };

    view.addEventListener('click', async event => {
        if (event.target.closest('#close-trivia-result') && state.status === 'completed') {
            closedResultId = resultId(state.result);
            render();
            document.getElementById('trivia-title')?.focus({ preventScroll: true });
            return;
        }

        const option = event.target.closest('[data-option-id]');
        if (option && state.status === 'in_progress' && !state.savingAnswer) {
            const question = state.attempt.questions[state.currentIndex];
            const previousOptionId = state.answers[question.id] || null;
            const optionId = option.dataset.optionId;
            setState({ type: 'ANSWER_SAVING', questionId: question.id, optionId });
            try {
                await saveDailyTriviaAnswer(question.id, optionId, { signal });
                if (!signal.aborted) {
                    setState({ type: 'ANSWER_SAVED' });
                    advanceQuestion();
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setState({
                        type: 'ANSWER_FAILED',
                        questionId: question.id,
                        previousOptionId,
                        error: error.message
                    });
                }
            }
            return;
        }

        if (event.target.closest('#retry-trivia')) return void loadStatus();
        if (event.target.closest('#start-trivia')) {
            view.innerHTML = loadingTemplate('Preparando preguntas...');
            view.setAttribute('aria-busy', 'true');
            try {
                const attempt = await startDailyTrivia({ signal });
                if (!signal.aborted) setState({ type: 'START', attempt });
            } catch (error) {
                if (error.name !== 'AbortError') setState({ type: 'ERROR', error: error.message });
            }
            return;
        }
        if (event.target.closest('#cancel-submit')) {
            document.getElementById('submit-dialog')?.close();
            return;
        }
        if (event.target.closest('#confirm-submit')) {
            if (!todasRespondidas(state)) return;
            setState({ type: 'SUBMITTING' });
            try {
                const result = await submitDailyTrivia({ signal });
                if (!signal.aborted) setState({ type: 'COMPLETED', result });
            } catch (error) {
                if (error.name !== 'AbortError') setState({ type: 'ERROR', error: error.message });
            }
        }
    });

    const refreshDay = () => {
        if (signal.aborted || ['loading', 'in_progress', 'submitting'].includes(state.status)) return;
        if (displayedDay !== localDateValue(new Date())) void loadStatus();
    };
    const dayTimer = setInterval(refreshDay, 1000);
    document.addEventListener('visibilitychange', refreshDay, { signal });

    signal.addEventListener('abort', () => {
        clearInterval(dayTimer);
        clearInterval(countdownTimer);
    }, { once: true });
    void loadStatus();
}
