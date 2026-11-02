// Official beta protocol; credentials remain in the existing backend client.
// Request is injected to reuse backend-client and keep credentials centralized.
export async function getGameServerClient() {
    const { solicitarBackend } = await import('./backend-client.js');
    return createGameServerClient(solicitarBackend);
}
export function createGameServerClient(request, {timeoutMs = 15000} = {}) {
    const boundedRequest = async (path, options = {}) => {
        const controller = new AbortController();
        const cancel = () => controller.abort();
        if (options.signal?.aborted) controller.abort();
        else options.signal?.addEventListener('abort',cancel,{once:true});
        const timeout = setTimeout(cancel,timeoutMs);
        try { return await request(path,{...options,signal:controller.signal}); }
        finally { clearTimeout(timeout); options.signal?.removeEventListener('abort',cancel); }
    };
    const root = '/api/v1/games/beta';
    const encoded = value => encodeURIComponent(value);
    const post = (path,body,key,signal) => boundedRequest(path,{method:'POST',body,headers:{'Idempotency-Key':key},signal});
    return {
        config: signal => boundedRequest(root+'/config',{authenticated:false,signal}),
        current: signal => boundedRequest(root+'/current',{signal}),
        start: (mode,key,signal) => post(root,{mode},key,signal),
        read: (id,signal) => boundedRequest(`${root}/${encoded(id)}`,{signal}),
        probe: (id,probe,revision,key,signal) => post(`${root}/${encoded(id)}/probe`,{probe,expected_revision:revision},key,signal),
        nextPitch: (id,revision,key,signal) => post(`${root}/${encoded(id)}/pitches`,{expected_revision:revision},key,signal),
        swing: (id,pitchId,revision,key,signal) => post(`${root}/${encoded(id)}/pitches/${encoded(pitchId)}/swing`,{expected_revision:revision},key,signal),
        transition: (id,action,revision,key,signal) => post(`${root}/${encoded(id)}/transitions`,{action,expected_revision:revision},key,signal),
        complete: (id,key,signal) => post(`${root}/${encoded(id)}/complete`,{},key,signal)
    };
}
