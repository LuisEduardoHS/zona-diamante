import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/js/features/trivia/trivia-state.js', import.meta.url), 'utf8');
const { crearEstadoTrivia, triviaReducer, respuestaActual, respuestasParaEnvio } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const attempt = {
    attempt_id: 'mock-1',
    questions: [
        { id: 'q1', options: [{ id: 'a' }, { id: 'b' }] },
        { id: 'q2', options: [{ id: 'a' }, { id: 'b' }] }
    ]
};

test('la trivia conserva respuestas al navegar y prepara el contrato de envío', () => {
    let state = triviaReducer(crearEstadoTrivia(), { type: 'START', attempt });
    state = triviaReducer(state, { type: 'ANSWER', questionId: 'q1', optionId: 'b' });
    state = triviaReducer(state, { type: 'GO_TO', index: 1 });
    state = triviaReducer(state, { type: 'ANSWER', questionId: 'q2', optionId: 'a' });
    assert.equal(respuestaActual(state), 'a');
    state = triviaReducer(state, { type: 'GO_TO', index: 0 });
    assert.equal(respuestaActual(state), 'b');
    assert.deepEqual(respuestasParaEnvio(state), [
        { question_id: 'q1', option_id: 'b' },
        { question_id: 'q2', option_id: 'a' }
    ]);
});

test('limita la navegación al rango de preguntas y acepta resultados del servicio', () => {
    let state = triviaReducer(crearEstadoTrivia(), { type: 'START', attempt });
    state = triviaReducer(state, { type: 'GO_TO', index: 99 });
    assert.equal(state.currentIndex, 1);
    state = triviaReducer(state, { type: 'GO_TO', index: -4 });
    assert.equal(state.currentIndex, 0);
    const result = { correct_count: 2, total_questions: 2, next_available_at: '2026-10-07T06:00:00Z' };
    state = triviaReducer(state, { type: 'COMPLETED', result });
    assert.equal(state.status, 'completed');
    assert.strictEqual(state.result, result);
    assert.equal(state.nextAvailableAt, result.next_available_at);
});
