(function() {
    'use strict';

    var BRIDGE = 'xrkxq:dzmm-bridge:v1';
    var lastError = '';
    var lastKey = null;

    function short(value) {
        if (typeof value === 'string') return value.length > 180 ? value.slice(0, 180) + '…' : value;
        if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
        try {
            var json = JSON.stringify(value);
            return json.length > 240 ? json.slice(0, 240) + '…' : json;
        } catch (_) {
            return String(value);
        }
    }

    function safe(call, fallback) {
        try { return call(); } catch (error) { return fallback == null ? String(error) : fallback; }
    }

    function commandInfo(command, index) {
        if (!command) return null;
        return {
            index: index,
            code: command.code,
            indent: command.indent,
            parameters: Array.isArray(command.parameters) ? command.parameters.map(short) : []
        };
    }

    function interpreterInfo(interpreter, depth) {
        if (!interpreter || depth > 3) return null;
        var list = Array.isArray(interpreter._list) ? interpreter._list : [];
        var index = Number(interpreter._index || 0);
        var nearby = [];
        for (var i = Math.max(0, index - 3); i < Math.min(list.length, index + 8); i++) {
            nearby.push(commandInfo(list[i], i));
        }
        return {
            depth: depth,
            eventId: interpreter._eventId,
            index: index,
            listLength: list.length,
            waitMode: interpreter._waitMode || '',
            waitCount: interpreter._waitCount || 0,
            windowId: interpreter._windowId,
            current: commandInfo(list[index], index),
            nearby: nearby,
            child: interpreterInfo(interpreter._childInterpreter, depth + 1)
        };
    }

    function messageInfo(message, id) {
        if (!message) return null;
        return {
            id: id,
            busy: safe(function() { return !!message.isBusy(); }, false),
            texts: Array.isArray(message._texts) ? message._texts.map(short) : [],
            choices: Array.isArray(message._choices) ? message._choices.map(short) : [],
            choiceCallback: !!message._choiceCallback,
            scrollMode: !!message._scrollMode,
            positionType: message._positionType,
            background: message._background
        };
    }

    function messageWindowInfo(window, id) {
        if (!window) return null;
        var choice = window._choiceWindow;
        return {
            id: id,
            visible: !!window.visible,
            active: !!window.active,
            openness: window.openness,
            pause: !!window.pause,
            opening: !!window._opening,
            closing: !!window._closing,
            textState: window._textState ? {
                index: window._textState.index,
                length: window._textState.text && window._textState.text.length
            } : null,
            choiceWindow: choice ? {
                visible: !!choice.visible,
                active: !!choice.active,
                openness: choice.openness,
                index: choice._index,
                maxItems: safe(function() { return choice.maxItems(); }, null)
            } : null
        };
    }

    function imageCacheInfo() {
        var items = window.ImageManager && ImageManager._imageCache && ImageManager._imageCache._items || {};
        var keys = Object.keys(items);
        var pending = [];
        var errors = [];
        keys.forEach(function(key) {
            var bitmap = items[key] && items[key].bitmap;
            if (!bitmap) return;
            var entry = {
                key: short(key),
                url: short(bitmap._url || bitmap.url || ''),
                loadingState: bitmap._loadingState,
                ready: safe(function() { return !!bitmap.isReady(); }, false),
                error: safe(function() { return !!bitmap.isError(); }, false),
                requestOnly: safe(function() { return !!bitmap.isRequestOnly(); }, false),
                size: [bitmap.width || 0, bitmap.height || 0]
            };
            if (entry.error) errors.push(entry);
            else if (!entry.ready && !entry.requestOnly) pending.push(entry);
        });
        return {
            total: keys.length,
            ready: safe(function() { return !!ImageManager.isReady(); }, false),
            pending: pending.slice(0, 30),
            errors: errors.slice(0, 30)
        };
    }

    function collect() {
        var scene = window.SceneManager && SceneManager._scene;
        var map = window.$gameMap;
        var interpreter = map && map._interpreter;
        var messages = [];
        var windows = [];
        for (var id = 0; id <= 4; id++) {
            var message = null;
            if (id === 0 && window.$gameMessage) message = $gameMessage;
            if (window.$gameMessageEx && $gameMessageEx.window) {
                message = safe(function(currentId) {
                    return function() { return $gameMessageEx.window(currentId); };
                }(id), message);
            }
            messages.push(messageInfo(message, id));
            var messageWindow = scene && scene._messageExWindows && scene._messageExWindows[id];
            if (!messageWindow && id === 0 && scene) messageWindow = scene._messageWindow;
            windows.push(messageWindowInfo(messageWindow, id));
        }

        var mapId = map ? safe(function() { return map.mapId(); }, map._mapId) : null;
        var info = interpreterInfo(interpreter, 0);
        var images = imageCacheInfo();
        var diagnosis = '等待游戏运行';
        if (scene) diagnosis = '未发现目标死锁';
        if (mapId === 7 && info && info.waitMode === 'message' && Number(info.windowId) === 1) {
            diagnosis = '地图7：解释器正在等待1号消息窗口结束';
            var allText = messages.map(function(item) { return item && item.texts.join('\n') || ''; }).join('\n');
            if (allText.indexOf('回忆点数') >= 0) diagnosis = '已确认卡点：回忆点数教程停在1号窗口的 message wait';
        }
        if (mapId === 7 && info && Number(info.windowId) === 3) {
            diagnosis = '已进入3号专用弹窗流程';
            if (info.waitMode === 'image') diagnosis = '已确认卡点：3号弹窗正在等待皮肤图片加载';
        }
        if (info && info.waitMode === 'transfer') {
            diagnosis = images.ready ? '传送仍未完成，但图片缓存已就绪' : '传送场景正在等待图片资源';
            if (images.errors.length) diagnosis = '传送卡住：图片缓存中存在加载错误';
            else if (images.pending.length) diagnosis = '传送卡住：存在未完成的图片资源';
        }

        return {
            debugVersion: 13,
            time: new Date().toISOString(),
            diagnosis: diagnosis,
            scene: scene && scene.constructor && scene.constructor.name,
            mapId: mapId,
            sceneManager: {
                sceneStarted: !!(window.SceneManager && SceneManager._sceneStarted),
                sceneChanging: safe(function() { return !!SceneManager.isSceneChanging(); }, false),
                nextScene: window.SceneManager && SceneManager._nextScene && SceneManager._nextScene.constructor && SceneManager._nextScene.constructor.name,
                currentMapLoaded: scene && scene._mapLoaded,
                currentTransfer: scene && scene._transfer,
                dataMapLoaded: !!window.$dataMap,
                dataErrorUrl: window.DataManager && DataManager._errorUrl
            },
            playerTransfer: window.$gamePlayer ? {
                transferring: !!$gamePlayer._transferring,
                newMapId: $gamePlayer._newMapId,
                newX: $gamePlayer._newX,
                newY: $gamePlayer._newY,
                newDirection: $gamePlayer._newDirection,
                fadeType: $gamePlayer._fadeType,
                needsMapReload: !!$gamePlayer._needsMapReload
            } : null,
            interpreter: info,
            messages: messages,
            windows: windows,
            imageCache: images,
            input: {
                documentHasFocus: safe(function() { return document.hasFocus(); }, false),
                visibility: document.visibilityState,
                activeElement: document.activeElement && document.activeElement.tagName,
                currentState: window.Input ? Object.keys(Input._currentState || {}).filter(function(key) {
                    return Input._currentState[key];
                }) : [],
                touchTriggered: window.TouchInput && !!TouchInput._triggered,
                lastKey: lastKey
            },
            guards: {
                saveAdapter: !!window.XRKXQSaveAdapter,
                kvStorage: !!(window.StorageManager && StorageManager._xrkxqKvStorage),
                saveMigration: !!(window.DataManager && DataManager._xrkxqTutorialMigration),
                deadlockGuard: !!(window.SceneManager && SceneManager._xrkxqTutorialDeadlockGuard),
                caseSensitiveAssets: !!(window.ImageManager && ImageManager._xrkxqCaseSensitiveAssets)
            },
            lastError: lastError
        };
    }

    window.addEventListener('keydown', function(event) {
        lastKey = { type: 'keydown', key: event.key, code: event.code, time: new Date().toISOString() };
    }, true);
    window.addEventListener('keyup', function(event) {
        lastKey = { type: 'keyup', key: event.key, code: event.code, time: new Date().toISOString() };
    }, true);
    window.addEventListener('error', function(event) {
        lastError = short(event.error && event.error.stack || event.message || event);
    });
    window.addEventListener('unhandledrejection', function(event) {
        lastError = short(event.reason && event.reason.stack || event.reason || event);
    });

    setInterval(function() {
        var state = collect();
        window.__XRKXQ_DEBUG_STATE__ = state;
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ bridge: BRIDGE, type: 'debug-state', payload: state }, '*');
        }
    }, 500);
})();
