(function() {
    'use strict';

    if (window.dzmm || window.parent === window) return;

    var BRIDGE = 'xrkxq:dzmm-bridge:v1';
    var pending = Object.create(null);
    var sequence = 1;
    var ready = false;
    var saveHandler = null;
    var resolveReady;

    window.__xrkxqDzmmBridgeReady = new Promise(function(resolve) {
        resolveReady = resolve;
    });

    function post(message) {
        message.bridge = BRIDGE;
        window.parent.postMessage(message, '*');
    }

    function request(method, args, timeout) {
        var id = method + ':' + Date.now() + ':' + sequence++;
        return new Promise(function(resolve, reject) {
            var timer = setTimeout(function() {
                delete pending[id];
                reject(new Error(method + '_timeout'));
            }, timeout || 15000);
            pending[id] = { resolve: resolve, reject: reject, timer: timer };
            post({ type: 'request', id: id, method: method, args: args || [] });
        });
    }

    function notify(method, args) {
        post({ type: 'notify', method: method, args: args || [] });
    }

    function answerSaveAction(id, ok, payload) {
        post({
            type: 'save-action-result',
            id: id,
            ok: ok,
            payload: ok ? payload : undefined,
            error: ok ? undefined : String(payload && (payload.message || payload) || 'save_action_failed')
        });
    }

    window.addEventListener('message', function(event) {
        if (event.source !== window.parent) return;
        var data = event.data || {};
        if (data.bridge !== BRIDGE) return;

        if (data.type === 'ready') {
            if (!ready) {
                ready = true;
                resolveReady(true);
                window.dispatchEvent(new MessageEvent('message', { data: { type: 'dzmm:ready', source: BRIDGE } }));
            }
            return;
        }

        if (data.type === 'response') {
            var waiter = pending[data.id];
            if (!waiter) return;
            delete pending[data.id];
            clearTimeout(waiter.timer);
            if (data.ok === false) waiter.reject(new Error(data.error || 'bridge_error'));
            else waiter.resolve(data.payload);
            return;
        }

        if (data.type === 'save-action') {
            if (!saveHandler) {
                answerSaveAction(data.id, true, { ok: false, code: 'unsupported' });
                return;
            }
            Promise.resolve().then(function() {
                return saveHandler(data.request || {});
            }).then(function(result) {
                answerSaveAction(data.id, true, result);
            }).catch(function(error) {
                answerSaveAction(data.id, false, error);
            });
        }
    });

    window.dzmm = {
        __xrkxqParentBridge: true,
        loading: {
            progress: function(payload) { notify('loading.progress', [payload]); },
            ready: function() { notify('loading.ready', []); },
            error: function(code, message) { notify('loading.error', [code, message]); }
        },
        kv: {
            get: function(key) { return request('kv.get', [key]); },
            put: function(key, value, options) { return request('kv.put', [key, value, options], 30000); },
            delete: function(key) { return request('kv.delete', [key]); }
        },
        save: {
            onAction: function(handler) { saveHandler = handler; }
        },
        toast: {
            success: function(message) { notify('toast.success', [message]); },
            error: function(message) { notify('toast.error', [message]); },
            warning: function(message) { notify('toast.warning', [message]); },
            info: function(message) { notify('toast.info', [message]); }
        }
    };

    var helloTimer = setInterval(function() {
        if (ready) clearInterval(helloTimer);
        else post({ type: 'hello' });
    }, 400);
    post({ type: 'hello' });
})();
