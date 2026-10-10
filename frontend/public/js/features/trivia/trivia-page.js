import { getCachedDailyTriviaStatus, getDailyTriviaStatus, startDailyTrivia, submitDailyTrivia } from '../../api/trivia-client.js';
import { RUTAS, ruta } from '../../app/rutas.js';
import { crearEstadoTrivia, respuestaActual, respuestasParaEnvio, triviaReducer } from './trivia-state.js';

const escapeHTML = value => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));

const QUESTION_SECONDS = 10;
let closedResultId;
const resultId = result => result.attempt_id || result.completed_at || result.next_available_at;

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
        <div class="trivia-timer-row">
            <div class="timer-track" role="progressbar" aria-label="Tiempo restante para la pregunta ${state.currentIndex + 1}" aria-valuemin="0" aria-valuemax="${QUESTION_SECONDS}" aria-valuenow="${QUESTION_SECONDS}">
                <div class="timer-bar" id="question-time-bar"></div>
            </div>
            <div class="question-timer" id="question-timer">${QUESTION_SECONDS}s</div>
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
            ${question.options.map(option => `<button class="answer${selected === option.id ? ' selected' : ''}" type="button" data-option-id="${escapeHTML(option.id)}" aria-pressed="${selected === option.id}">${escapeHTML(option.text)}</button>`).join('')}
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
        <span class="trivia-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor"><!-- Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc. --><path d="M530.8 134.1C545.1 144.5 548.3 164.5 537.9 178.8L281.9 530.8C276.4 538.4 267.9 543.1 258.5 543.9C249.1 544.7 240 541.2 233.4 534.6L105.4 406.6C92.9 394.1 92.9 373.8 105.4 361.3C117.9 348.8 138.2 348.8 150.7 361.3L252.2 462.8L486.2 141.1C496.6 126.8 516.6 123.6 530.9 134z"/></svg></span>
        <h2>¡Reto completado!</h2>
        <div class="trivia-result">
            <div class="trivia-stat"><strong>${Number(result.correct_count)} / ${Number(result.total_questions)}</strong>respuestas correctas</div>
            <div class="trivia-stat"><strong>+${Number(result.points_earned)}</strong>puntos ganados</div>
        </div>
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
        <p class="trivia-copy">Inténtalo de nuevo más tarde. Prepararemos un nuevo reto para ti.</p>
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
    let questionTimer;
    let advanceTimer;
    let timedQuestionId;
    let questionDeadline;

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

    const stopQuestionTimer = () => {
        clearInterval(questionTimer);
        questionTimer = null;
    };

    const openSubmitDialog = () => {
        stopQuestionTimer();
        document.getElementById('submit-dialog')?.showModal();
        const app = document.getElementById('trivia-app');
        if (app) app.scrollTop = 0;
    };

    const advanceQuestion = () => {
        clearTimeout(advanceTimer);
        stopQuestionTimer();
        if (state.status !== 'in_progress') return;
        const last = state.currentIndex === state.attempt.questions.length - 1;
        if (last) openSubmitDialog();
        else setState({ type: 'GO_TO', index: state.currentIndex + 1 });
    };

    const startQuestionTimer = () => {
        const question = state.attempt?.questions[state.currentIndex];
        if (!question) return;
        if (timedQuestionId !== question.id) {
            timedQuestionId = question.id;
            questionDeadline = Date.now() + QUESTION_SECONDS * 1000;
        }
        const update = () => {
            const remaining = Math.max(0, questionDeadline - Date.now());
            const seconds = Math.ceil(remaining / 1000);
            const percentage = (remaining / (QUESTION_SECONDS * 1000)) * 100;
            const output = document.getElementById('question-timer');
            const bar = document.getElementById('question-time-bar');
            const track = bar?.parentElement;
            if (output) output.textContent = `${seconds}s`;
            if (bar) bar.style.width = `${percentage}%`;
            track?.setAttribute('aria-valuenow', String(Math.ceil(remaining / 1000)));
            if (remaining <= 0) advanceQuestion();
        };
        update();
        questionTimer = setInterval(update, 100);
    };

    const render = () => {
        clearInterval(countdownTimer);
        stopQuestionTimer();
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
        // Los navegadores pueden desplazar internamente el contenedor para hacer
        // visible el botón pulsado. Cada pregunta debe comenzar alineada arriba.
        if (app) app.scrollTop = 0;
        view.querySelector('#submit-dialog')?.addEventListener('close', () => {
            if (app) app.scrollTop = 0;
        });
        if (state.status === 'in_progress') startQuestionTimer();
        else {
            timedQuestionId = null;
            questionDeadline = null;
        }
        if (state.status === 'completed') startCountdown(state.nextAvailableAt);
    };

    const applyStatus = status => {
        if (status.status === 'completed' && status.last_result) setState({ type: 'COMPLETED', result: status.last_result });
        else if (status.status === 'available') setState({ type: 'STATUS_AVAILABLE' });
        else setState({ type: 'STATUS_UNAVAILABLE', nextAvailableAt: status.next_available_at });
    };

    const loadStatus = async () => {
        displayedDay = localDateValue(new Date());
        const cached = getCachedDailyTriviaStatus();
        if (cached) {
            applyStatus(cached);
            return;
        }
        state = crearEstadoTrivia();
        render();
        try {
            const status = await getDailyTriviaStatus({ signal });
            if (signal.aborted) return;
            applyStatus(status);
        } catch (error) {
            if (error.name !== 'AbortError') setState({ type: 'ERROR', error: 'Revisa tu conexión e inténtalo de nuevo.' });
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
        if (option && state.status === 'in_progress') {
            const question = state.attempt.questions[state.currentIndex];
            setState({ type: 'ANSWER', questionId: question.id, optionId: option.dataset.optionId });
            clearTimeout(advanceTimer);
            advanceTimer = setTimeout(advanceQuestion, 380);
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
                if (error.name !== 'AbortError') setState({ type: 'ERROR', error: 'No pudimos iniciar el reto. Inténtalo de nuevo.' });
            }
            return;
        }
        if (event.target.closest('#cancel-submit')) {
            document.getElementById('submit-dialog')?.close();
            timedQuestionId = null;
            startQuestionTimer();
            return;
        }
        if (event.target.closest('#confirm-submit')) {
            const attempt = state.attempt;
            const answers = respuestasParaEnvio(state);
            setState({ type: 'SUBMITTING' });
            try {
                const result = await submitDailyTrivia(attempt.attempt_id, answers, { signal });
                if (!signal.aborted) setState({ type: 'COMPLETED', result });
            } catch (error) {
                if (error.name !== 'AbortError') setState({ type: 'ERROR', error: 'No pudimos enviar tus respuestas. Inténtalo de nuevo.' });
            }
        }
    });

    // También comprueba el día al volver de una pestaña suspendida. No reinicia
    // una partida ni un envío en curso cuando el reloj cruza la medianoche.
    const refreshDay = () => {
        if (signal.aborted || ['loading', 'in_progress', 'submitting'].includes(state.status)) return;
        if (displayedDay !== localDateValue(new Date())) void loadStatus();
    };
    const dayTimer = setInterval(refreshDay, 1000);
    document.addEventListener('visibilitychange', refreshDay, { signal });

    signal.addEventListener('abort', () => {
        clearInterval(dayTimer);
        clearInterval(countdownTimer);
        stopQuestionTimer();
        clearTimeout(advanceTimer);
    }, { once: true });
    void loadStatus();
}
