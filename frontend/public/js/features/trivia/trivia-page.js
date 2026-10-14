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

function availableTemplate(completed = false, guest = false) {
    return `<div class="trivia-screen trivia-cover">
        ${calendarTemplate()}
        <div class="trivia-cover-title">
            <h1 id="trivia-title" tabindex="-1">Trivia</h1>
            <p>Reto del día</p>
        </div>
        <img class="trivia-cover-ball" src="${ruta('assets/img/trivia/pelota-beis.webp')}" alt="" aria-hidden="true">
        ${guest ? `<div class="trivia-guest-actions">
            <p id="trivia-signin-note">Inicia sesión para jugar<br>y sumar puntos con tus aciertos.</p>
            <a class="trivia-button trivia-button--link" href="${escapeHTML(ruta(RUTAS.login) + '?next=' + encodeURIComponent(new URL(ruta(RUTAS.trivia)).pathname))}" aria-describedby="trivia-signin-note">Iniciar sesión</a>
        </div>` : completed
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


// Add future score-specific artwork here; other scores deliberately show only points.
const resultIllustrations = [
    { scores: [4, 5], file: 'PTrivia-PanchoP.webp', alt: 'Pancho celebrando tus aciertos' },
    { scores: [2, 3], file: 'PTrivia-Pollo.webp', alt: 'Pollo pensando en las respuestas' }
];

function completedTemplate(result, stage) {
    const points = Number(result.points_earned) || 0;
    const artwork = resultIllustrations.find(item => item.scores.includes(Number(result.correct_count)));
    const reward = `<span aria-hidden="true">+ <span data-count="${points}">${points}</span> puntos</span><span class="sr-only">Ganaste ${points} puntos</span>`;
    return `<dialog class="trivia-finale" id="trivia-finale" aria-label="${stage === 'reward' ? 'Puntos ganados' : 'Resultado de la trivia'}">
        <div class="trivia-finale-layout ${stage === 'reward' ? 'is-reward' : 'is-summary'}">
            ${stage === 'reward' ? `<div class="trivia-celebration">
                ${artwork ? `<img class="trivia-celebration-art" src="${ruta(`assets/img/trivia/${artwork.file}`)}" alt="${escapeHTML(artwork.alt)}" width="1080" height="1080">` : '<div class="trivia-art-placeholder" aria-hidden="true"></div>'}
                <div class="trivia-reward-pill">${reward}</div>
            </div>` : `<div class="trivia-reward-toast">${reward}</div>
            <section class="trivia-summary" aria-labelledby="trivia-result-title">
                <h2 id="trivia-result-title">¡Reto completado!</h2>
                <div class="trivia-summary-stats">
                    <div><strong><span data-count="${Number(result.correct_count)}">${Number(result.correct_count)}</span> / ${Number(result.total_questions)}</strong><span>respuestas<br>correctas</span></div>
                    <div><strong data-count="${Number(result.points_balance) || 0}">${Number(result.points_balance) || 0}</strong><span>Balance</span></div>
                </div>
                <p>Nueva trivia en:<strong id="trivia-countdown" role="timer" aria-live="off">--:--:--</strong></p>
                <a class="trivia-collection" href="${ruta(RUTAS.coleccion)}">Mi colección</a>
            </section>`}
            <button class="trivia-continue" id="close-trivia-result" type="button">Presiona para continuar<span aria-hidden="true"> ›</span></button>
        </div>
    </dialog>`;
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
    let resultStage = 'summary';
    let resultBackdrop = '';
    let animationFrame;

    const continueResult = () => {
        if (state.status !== 'completed') return;
        if (resultStage === 'reward') resultStage = 'summary';
        else closedResultId = resultId(state.result);
        render();
        if (closedResultId === resultId(state.result)) document.getElementById('trivia-title')?.focus({ preventScroll: true });
    };

    const animateResult = dialog => {
        if (!dialog || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const counters = [...dialog.querySelectorAll('[data-count]')];
        const start = performance.now();
        const tick = now => {
            const progress = Math.min(1, (now - start) / 1000);
            counters.forEach(node => { node.textContent = Math.round(Number(node.dataset.count) * (1 - (1 - progress) ** 3)); });
            if (progress < 1 && !signal.aborted) animationFrame = requestAnimationFrame(tick);
        };
        animationFrame = requestAnimationFrame(tick);
    };

    const setState = action => {
        state = triviaReducer(state, action);
        render();
    };

    const handleError = error => {
        if (signal.aborted || error.name === 'AbortError') return;
        setState(error.status === 401
            ? { type: 'SESSION_REQUIRED' }
            : { type: 'ERROR', error: error.message });
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
        if (animationFrame) cancelAnimationFrame(animationFrame);
        const app = document.getElementById('trivia-app');
        app?.setAttribute('data-status', state.status);
        view.setAttribute('aria-busy', String(['loading', 'submitting'].includes(state.status)));
        const templates = {
            loading: () => loadingTemplate(),
            available: availableTemplate,
            guest: () => availableTemplate(false, true),
            in_progress: () => questionTemplate(state),
            submitting: submittingTemplate,
            completed: () => closedResultId === resultId(state.result) ? availableTemplate(true) : (resultBackdrop || availableTemplate(false)) + completedTemplate(state.result, resultStage),
            unavailable: unavailableTemplate,
            error: () => errorTemplate(state.error)
        };
        view.innerHTML = (templates[state.status] || errorTemplate)();
        if (app) app.scrollTop = 0;
        view.querySelector('#submit-dialog')?.addEventListener('close', () => {
            if (app) app.scrollTop = 0;
        });
        if (state.status === 'completed') startCountdown(state.nextAvailableAt);
        const finale = view.querySelector('#trivia-finale');
        if (finale) {
            finale.showModal();
            finale.querySelector('.trivia-continue')?.focus({ preventScroll: true });
            finale.addEventListener('cancel', event => { event.preventDefault(); continueResult(); }, { signal });
            finale.addEventListener('click', event => {
                if (event.target.closest('a, button') || event.detail > 1) return;
                continueResult();
            }, { signal });
            animateResult(finale);
        }
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
        resultStage = 'summary';
        resultBackdrop = '';
        state = crearEstadoTrivia();
        render();
        try {
            const status = await getDailyTriviaStatus({ signal });
            if (!signal.aborted) await applyStatus(status);
        } catch (error) {
            handleError(error);
        }
    };

    view.addEventListener('click', async event => {
        if (event.target.closest('#close-trivia-result') && state.status === 'completed') {
            if (event.detail > 1) return;
            continueResult();
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
                if (error.status === 401) return handleError(error);
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
                handleError(error);
            }
            return;
        }
        if (event.target.closest('#cancel-submit')) {
            document.getElementById('submit-dialog')?.close();
            return;
        }
        if (event.target.closest('#confirm-submit')) {
            if (!todasRespondidas(state)) return;
            resultBackdrop = questionTemplate(state);
            resultStage = 'reward';
            setState({ type: 'SUBMITTING' });
            try {
                const result = await submitDailyTrivia({ signal });
                if (!signal.aborted) setState({ type: 'COMPLETED', result });
            } catch (error) {
                handleError(error);
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
        if (animationFrame) cancelAnimationFrame(animationFrame);
        view.querySelector('#trivia-finale')?.close();
    }, { once: true });
    void loadStatus();
}
