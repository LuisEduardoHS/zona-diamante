// Explicit development adapter: no economic RPC, fake JWT, pending prize or
// future claim. A local result can NEVER become a server-confirmed reward.
export function createPracticeSession({ newId = () => crypto.randomUUID() } = {}) {
    return {
        kind:'local-practice',
        start(mode) { return {id:'practice:'+newId(),mode,verified:false}; },
        complete() { return {source:'local-practice',confirmedResult:null,reward:{status:'unavailable',pointsAwarded:null,pointsBalance:null}}; }
    };
}
export function practiceRecords(storage, user = 'guest') {
    const key = mode => `zd:game:practice:${user}:${mode}`;
    function read(mode) {
        try {
            const row = JSON.parse(storage.getItem(key(mode)) || '{}');
            return {score:Number.isSafeInteger(row.score) && row.score >= 0 ? row.score : 0,
                streak:Number.isSafeInteger(row.streak) && row.streak >= 0 ? row.streak : 0};
        } catch { return {score:0,streak:0}; }
    }
    return {read, save(mode,stats) {
        const old = read(mode), record = {score:Math.max(old.score,stats.score),streak:Math.max(old.streak,stats.bestStreak)};
        try { storage.setItem(key(mode),JSON.stringify(record)); } catch { /* Records are optional, never currency. */ }
        return record;
    }};
}
