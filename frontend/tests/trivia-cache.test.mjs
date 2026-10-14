import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let source = await readFile(new URL('../public/js/api/trivia-client.js', import.meta.url), 'utf8');
source = source.replace(
    /^import .*backend-client.js';/m,
    'const solicitarBackend = (...args) => globalThis.backendFixture(...args);'
);
const client = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('consulta el estado autenticado y normaliza un resultado completado', async () => {
    const calls = [];
    globalThis.backendFixture = async (...args) => {
        calls.push(args);
        return {
            status: 'completed', trivia_date: '2026-10-14', attempt_id: 'attempt-1',
            score: 4, question_count: 5, points_earned: 80, points_balance: 320,
            next_available_at: '2026-10-15T00:00:00-06:00'
        };
    };
    const status = await client.getDailyTriviaStatus();
    assert.equal(calls[0][0], '/api/v1/trivia/daily');
    assert.equal(status.last_result.correct_count, 4);
    assert.equal(status.last_result.points_earned, 80);
    assert.strictEqual(client.getCachedDailyTriviaStatus(), status);
});

test('inicia, guarda cada respuesta y envía sin aceptar score ni puntos', async () => {
    const calls = [];
    globalThis.backendFixture = async (path, options = {}) => {
        calls.push([path, options]);
        if (path.endsWith('/submit')) {
            return { score: 5, question_count: 5, points_earned: 100, points_balance: 500 };
        }
        return { saved: true };
    };
    await client.startDailyTrivia();
    await client.saveDailyTriviaAnswer('question/1', 'option-1');
    const result = await client.submitDailyTrivia();

    assert.deepEqual(calls.map(call => [call[0], call[1].method]), [
        ['/api/v1/trivia/daily/start', 'POST'],
        ['/api/v1/trivia/daily/answers/question%2F1', 'PUT'],
        ['/api/v1/trivia/daily/submit', 'POST']
    ]);
    assert.deepEqual(calls[1][1].body, { selected_option_id: 'option-1' });
    assert.equal(calls[2][1].body, undefined);
    assert.equal(result.correct_count, 5);
    assert.equal(result.points_earned, 100);
});
