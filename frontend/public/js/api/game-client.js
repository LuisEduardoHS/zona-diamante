// Official beta protocol; credentials remain in the existing backend client.
// Request is injected to reuse backend-client and keep credentials centralized.
export async function getGameServerClient() {
    const { solicitarBackend } = await import('./backend-client.js');
    return createGameServerClient(solicitarBackend);
}
export function createGameServerClient(request) {
    const root = '/api/v1/games/beta';
    const encoded = value => encodeURIComponent(value);
    const post = (path,body,key,signal) => request(path,{method:'POST',body,headers:{'Idempotency-Key':key},signal});
    return {
        config: signal => request(root+'/config',{authenticated:false,signal}),
        current: signal => request(root+'/current',{signal}),
        start: (mode,key,signal) => post(root,{mode},key,signal),
        read: (id,signal) => request(`${root}/${encoded(id)}`,{signal}),
        probe: (id,probe,revision,key,signal) => post(`${root}/${encoded(id)}/probe`,{probe,expected_revision:revision},key,signal),
        nextPitch: (id,revision,key,signal) => post(`${root}/${encoded(id)}/pitches`,{expected_revision:revision},key,signal),
        swing: (id,pitchId,revision,key,signal) => post(`${root}/${encoded(id)}/pitches/${encoded(pitchId)}/swing`,{expected_revision:revision},key,signal),
        transition: (id,action,revision,key,signal) => post(`${root}/${encoded(id)}/transitions`,{action,expected_revision:revision},key,signal),
        complete: (id,key,signal) => post(`${root}/${encoded(id)}/complete`,{},key,signal)
    };
}
