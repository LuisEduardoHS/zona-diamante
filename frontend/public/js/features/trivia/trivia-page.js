import { getDailyTriviaStatus, startDailyTrivia, submitDailyTrivia } from '../../api/trivia-client.js';
import { RUTAS, ruta } from '../../app/rutas.js';
import { crearEstadoTrivia, respuestaActual, respuestasParaEnvio, triviaReducer } from './trivia-state.js';

const escapeHTML = value => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));

const icono = (symbol, label = '') => `<span class="trivia-icon" aria-hidden="true">${symbol}</span>${label ? `<span class="sr-only">${escapeHTML(label)}</span>` : ''}`;

function loadingTemplate(label = 'Cargando reto del día...') {
    return `<div class="trivia-loading" role="status">
        <span class="skeleton skeleton-badge"></span><span class="skeleton skeleton-title"></span>
        <span class="skeleton skeleton-copy"></span><span class="skeleton skeleton-button"></span>
        <span class="sr-only">${escapeHTML(label)}</span>
    </div>`;
}

function availableTemplate() {
    return `<div class="trivia-screen trivia-screen--center"><div>
        ${icono('★', 'Reto disponible')}
        <h2>¿Listo para jugar?</h2>
        <p class="trivia-copy">Responde el reto de hoy y descubre cuánto sabes de béisbol.</p>
        <div class="trivia-meta">
            <span class="trivia-pill">◆ Reto diario · recompensa en puntos</span>
        </div>
        <button class="trivia-button" id="start-trivia" type="button">Comenzar trivia</button>
    </div></div>`;
}

function questionTemplate(state) {
    const { questions } = state.attempt;
    const question = questions[state.currentIndex];
    const selected = respuestaActual(state);
    const last = state.currentIndex === questions.length - 1;
    const progress = ((state.currentIndex + 1) / questions.length) * 100;
    return `<div class="trivia-screen">
        <div class="trivia-progress-header">
            <span>Pregunta ${state.currentIndex + 1} de ${questions.length}</span>
            <span>${Object.keys(state.answers).length} respondidas</span>
        </div>
        <div class="progress-container" role="progressbar" aria-label="Progreso de la trivia" aria-valuemin="1" aria-valuemax="${questions.length}" aria-valuenow="${state.currentIndex + 1}">
            <div class="progress-bar" style="width:${progress}%"></div>
        </div>
        <section class="question-card" aria-labelledby="question-text">
            <div class="question-image">
                <img src="${ruta('assets/img/trivia/img1.webp')}" alt="" aria-hidden="true">
                <div class="question-overlay"></div>
                <h2 id="question-text">${escapeHTML(question.text)}</h2>
            </div>
        </section>
        <div class="answers" role="group" aria-labelledby="question-text">
            ${question.options.map(option => `<button class="answer${selected === option.id ? ' selected' : ''}" type="button" data-option-id="${escapeHTML(option.id)}" aria-pressed="${selected === option.id}">${escapeHTML(option.text)}</button>`).join('')}
        </div>
        <div class="trivia-actions">
            <button class="trivia-button trivia-button--secondary" id="previous-question" type="button" ${state.currentIndex === 0 ? 'disabled' : ''}>Anterior</button>
            <button class="trivia-button" id="next-question" type="button" ${selected ? '' : 'disabled'}>${last ? 'Finalizar trivia' : 'Siguiente'}</button>
        </div>
        <p class="trivia-help">Puedes volver y cambiar tus respuestas antes de enviarlas.</p>
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
    return `<div class="trivia-screen trivia-screen--center"><div>
        ${icono('✓', 'Trivia completada')}
        <h2>Reto de hoy completado</h2>
        <p class="trivia-copy">¡Buen juego! Tu resultado del día ya quedó registrado.</p>
        <div class="trivia-result">
            <div class="trivia-stat"><strong>${Number(result.correct_count)} / ${Number(result.total_questions)}</strong>respuestas correctas</div>
            <div class="trivia-stat"><strong>+${Number(result.points_earned)}</strong>puntos obtenidos</div>
            <div class="trivia-stat"><strong>${Number(result.score)}%</strong>resultado</div>
            <div class="trivia-stat"><strong>${Number(result.points_balance).toLocaleString('es-MX')}</strong>saldo total</div>
        </div>
        <p class="trivia-countdown">Nueva trivia en:<strong id="trivia-countdown">--:--:--</strong></p>
        <div class="trivia-complete-actions">
            <a class="trivia-button trivia-button--link" href="${ruta(RUTAS.coleccion)}">Ir a mi colección</a>
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
    const date = document.getElementById('trivia-date');
    if (!view || !date) return;

    date.textContent = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    let state = crearEstadoTrivia();
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
            completed: () => completedTemplate(state.result),
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
        if (state.status === 'completed') startCountdown(state.nextAvailableAt);
    };

    const loadStatus = async () => {
        state = crearEstadoTrivia();
        render();
        try {
            const status = await getDailyTriviaStatus({ signal });
            if (signal.aborted) return;
            if (status.status === 'completed' && status.last_result) setState({ type: 'COMPLETED', result: status.last_result });
            else if (status.status === 'available') setState({ type: 'STATUS_AVAILABLE' });
            else setState({ type: 'STATUS_UNAVAILABLE', nextAvailableAt: status.next_available_at });
        } catch (error) {
            if (error.name !== 'AbortError') setState({ type: 'ERROR', error: 'Revisa tu conexión e inténtalo de nuevo.' });
        }
    };

    view.addEventListener('click', async event => {
        const option = event.target.closest('[data-option-id]');
        if (option && state.status === 'in_progress') {
            const question = state.attempt.questions[state.currentIndex];
            setState({ type: 'ANSWER', questionId: question.id, optionId: option.dataset.optionId });
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
        if (event.target.closest('#previous-question')) return setState({ type: 'GO_TO', index: state.currentIndex - 1 });
        if (event.target.closest('#next-question')) {
            const last = state.currentIndex === state.attempt.questions.length - 1;
            if (last) {
                document.getElementById('submit-dialog')?.showModal();
                if (view.parentElement) view.parentElement.scrollTop = 0;
            }
            else setState({ type: 'GO_TO', index: state.currentIndex + 1 });
            return;
        }
        if (event.target.closest('#cancel-submit')) return document.getElementById('submit-dialog')?.close();
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

    signal.addEventListener('abort', () => clearInterval(countdownTimer), { once: true });
    render();
    void loadStatus();
}
