import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/js/features/trivia/trivia-state.js', import.meta.url), 'utf8');
const { crearEstadoTrivia, triviaReducer, respuestaActual, todasRespondidas } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const attempt = {
    attempt_id: 'mock-1',
    questions: [
        { id: 'q1', selected_option_id: 'b', options: [{ id: 'a' }, { id: 'b' }] },
        { id: 'q2', selected_option_id: null, options: [{ id: 'a' }, { id: 'b' }] }
    ]
};

test('reanuda respuestas persistidas y se posiciona en la primera pendiente', () => {
    let state = triviaReducer(crearEstadoTrivia(), { type: 'START', attempt });
    assert.equal(state.currentIndex, 1);
    assert.equal(state.answers.q1, 'b');
    state = triviaReducer(state, { type: 'ANSWER_SAVING', questionId: 'q2', optionId: 'a' });
    assert.equal(respuestaActual(state), 'a');
    assert.equal(state.savingAnswer, true);
    state = triviaReducer(state, { type: 'ANSWER_SAVED' });
    assert.equal(state.savingAnswer, false);
    assert.equal(todasRespondidas(state), true);
});

test('revierte una selección si el backend no logra guardarla', () => {
    let state = triviaReducer(crearEstadoTrivia(), { type: 'START', attempt });
    state = triviaReducer(state, { type: 'ANSWER_SAVING', questionId: 'q2', optionId: 'a' });
    state = triviaReducer(state, { type: 'ANSWER_FAILED', questionId: 'q2', previousOptionId: null, error: 'sin red' });
    assert.equal(state.answers.q2, undefined);
    assert.equal(state.saveError, 'sin red');
});

test('limita la navegación y acepta resultados del backend', () => {
    let state = triviaReducer(crearEstadoTrivia(), { type: 'START', attempt });
    state = triviaReducer(state, { type: 'GO_TO', index: 99 });
    assert.equal(state.currentIndex, 1);
    state = triviaReducer(state, { type: 'GO_TO', index: -4 });
    assert.equal(state.currentIndex, 0);
    const result = { correct_count: 2, total_questions: 2, next_available_at: '2026-10-07T06:00:00Z' };
    state = triviaReducer(state, { type: 'COMPLETED', result });
    assert.equal(state.status, 'completed');
    assert.strictEqual(state.result, result);
});
