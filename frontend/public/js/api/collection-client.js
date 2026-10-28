import { solicitarBackend } from './backend-client.js';

export const collectionApi = {
    catalog: signal => solicitarBackend('/api/v1/cards/catalog', { authenticated: false, signal }),
    collection: signal => solicitarBackend('/api/v1/cards', { signal }),
    purchase: (id, key, signal) => solicitarBackend(`/api/v1/cards/${encodeURIComponent(id)}/purchase`, {
        method: 'POST', headers: { 'Idempotency-Key': key }, signal
    })
};
