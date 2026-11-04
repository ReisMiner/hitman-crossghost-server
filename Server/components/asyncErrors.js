// Express 4 ignores the promise an async handler returns, so a rejected
// promise became an unhandled rejection, which ends the Node process. Route
// every handler's rejection to next(err) instead, like Express 5 does.
// Must be required before the first request is served.
const Layer = require('express/lib/router/layer');

if (!Layer.prototype.handle_request.crossGhostAsync) {
    const handleRequest = function handle(req, res, next) {
        const fn = this.handle;
        if (fn.length > 3) return next(); // error handlers use handle_error
        try {
            const result = fn(req, res, next);
            if (result && typeof result.then === 'function') {
                result.then(undefined, error => next(error || new Error('Route handler rejected')));
            }
        } catch (error) {
            next(error);
        }
    };
    handleRequest.crossGhostAsync = true;
    Layer.prototype.handle_request = handleRequest;
}
