// Optional local diagnostic, injected before application/dependency scripts.
// It records native failures and rethrows them. Never suppress console errors.
(() => {
    const endpoint = '/__observer-trace';
    const record = (kind, detail = {}) => {
        const entry = { kind, href: location.href, readyState: document.readyState,
            time: new Date().toISOString(), framed: window.parent !== window, ...detail };
        void fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry), keepalive: true }).catch(error => console.warn('Observer diagnostic transport failed', error));
    };
    const original = MutationObserver.prototype.observe;
    MutationObserver.prototype.observe = function (target, options) {
        let description;
        try {
            description = { type: typeof target, name: target?.constructor?.name,
                nodeType: target?.nodeType, id: target?.id, connected: target?.isConnected,
                owner: target?.ownerDocument?.URL };
        } catch (error) { description = { inspectionError: String(error) }; }
        const stack = new Error('MutationObserver.observe call').stack;
        try {
            const result = Reflect.apply(original, this, [target, options]);
            record('observe-ok', { target: description, stack });
            return result;
        } catch (error) {
            record('observe-error', { target: description, stack, error: String(error), errorStack: error.stack });
            throw error;
        }
    };
    window.addEventListener('error', event => record('window-error', {
        message: event.message, filename: event.filename, line: event.lineno, column: event.colno,
        stack: event.error?.stack,
    }));
    window.addEventListener('unhandledrejection', event => record('unhandled-rejection', {
        message: String(event.reason), stack: event.reason?.stack,
    }));
    record('installed');
})();
