(function() {
    'use strict';

    var root = window;
    var INDEX_KEY = 'xrkxq:rmmv:v1:index';
    var DATA_PREFIX = 'xrkxq:rmmv:v1:data:';
    var LOCAL_KEY = 'xrkxq:rmmv:local-preview:v1';
    var CHUNK_SIZE = 90000;
    var cache = Object.create(null);
    var index = Object.create(null);
    var dirty = Object.create(null);
    var flushTimer = 0;
    var flushChain = Promise.resolve();
    var enabled = true;
    var generation = 0;
    var saveActionInstalled = false;
    function migrateTutorialSaveJson(json) {
        // Never rewrite serialized event commands as text. RMMV saves the
        // running interpreter, so broad replacements can create a wait state
        // that no longer matches its message window.
        return json;
    }

    function recoverRunningTutorialInterpreter(interpreter, force) {
        if (!interpreter || !Array.isArray(interpreter._list)) return false;
        var list = interpreter._list;
        var recovered = false;
        for (var i = 0; i < list.length; i++) {
            var command = list[i];
            var text = command && command.code === 401 && command.parameters && command.parameters[0];
            if (typeof text !== 'string' || text.indexOf('要听关于「回忆点数」的说明吗？') < 0) continue;

            if (text.indexOf('\\^') < 0) command.parameters[0] += '\\^';
            var popupIndex = -1;
            var choiceIndex = -1;
            for (var j = i + 1; j < Math.min(list.length, i + 12); j++) {
                var next = list[j];
                if (popupIndex < 0 && next && next.code === 356) popupIndex = j;
                if (next && next.code === 102) {
                    choiceIndex = j;
                    break;
                }
            }
            if (popupIndex < 0 || choiceIndex < 0) continue;

            list[popupIndex].code = 356;
            list[popupIndex].parameters = ['EMW_メッセージウィンドウ指定 3 終了禁止'];
            if (list[popupIndex + 1]) {
                list[popupIndex + 1].code = 356;
                list[popupIndex + 1].parameters = ['MWP_VALID 7 3 1'];
            }

            var current = Number(interpreter._index || 0);
            if (interpreter._waitMode === 'message' && Number(interpreter._windowId) === 1 &&
                    current > i && current <= popupIndex) {
                if (!force && !interpreter._xrkxqTutorialStuckAt) {
                    interpreter._xrkxqTutorialStuckAt = Date.now();
                    return false;
                }
                if (!force && Date.now() - interpreter._xrkxqTutorialStuckAt < 1000) return false;
                interpreter._index = popupIndex;
                interpreter._waitMode = '';
                interpreter._windowId = 3;
                delete interpreter._xrkxqTutorialStuckAt;
                recovered = true;
            }
            break;
        }
        return recoverRunningTutorialInterpreter(interpreter._childInterpreter, force) || recovered;
    }

    function clearRecoveredTutorialMessages() {
        if (root.$gameMessageEx && root.$gameMessageEx.window) {
            root.$gameMessageEx.window(1).clear();
            root.$gameMessageEx.window(3).clear();
        }
        var scene = root.SceneManager && root.SceneManager._scene;
        var windows = scene && scene._messageExWindows;
        var oldWindow = windows && windows[1];
        if (oldWindow) {
            oldWindow.deactivate();
            oldWindow.close();
        }
    }

    function installTutorialSaveMigration() {
        var dataManager = root.DataManager;
        if (!dataManager || dataManager._xrkxqTutorialMigration) return;
        var originalExtract = dataManager.extractSaveContents;
        dataManager.extractSaveContents = function(contents) {
            originalExtract.apply(this, arguments);
            if (!root.$gameMap || root.$gameMap.mapId() !== 7) return;
            if (recoverRunningTutorialInterpreter(root.$gameMap._interpreter, true)) {
                clearRecoveredTutorialMessages();
            }
        };
        dataManager._xrkxqTutorialMigration = true;

        var sceneManager = root.SceneManager;
        if (sceneManager && !sceneManager._xrkxqTutorialDeadlockGuard) {
            var originalUpdateMain = sceneManager.updateMain;
            sceneManager.updateMain = function() {
                originalUpdateMain.apply(this, arguments);
                if (root.$gameMap && root.$gameMap.mapId() === 7 &&
                        recoverRunningTutorialInterpreter(root.$gameMap._interpreter, false)) {
                    clearRecoveredTutorialMessages();
                }
            };
            sceneManager._xrkxqTutorialDeadlockGuard = true;
        }
    }

    function sdk() {
        return root.dzmm && root.dzmm.kv ? root.dzmm : null;
    }

    function timeout(promise, milliseconds, code) {
        return new Promise(function(resolve, reject) {
            var done = false;
            var timer = setTimeout(function() {
                if (done) return;
                done = true;
                reject(new Error(code || 'timeout'));
            }, milliseconds);
            Promise.resolve(promise).then(function(value) {
                if (done) return;
                done = true;
                clearTimeout(timer);
                resolve(value);
            }, function(error) {
                if (done) return;
                done = true;
                clearTimeout(timer);
                reject(error);
            });
        });
    }

    function status(kind, text, retry) {
        var button = document.getElementById('xrkxq-save-status');
        if (!button) {
            button = document.createElement('button');
            button.id = 'xrkxq-save-status';
            button.type = 'button';
            button.style.cssText = 'position:fixed;right:12px;top:12px;z-index:99999;max-width:70vw;padding:8px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;background:rgba(15,18,24,.92);color:#fff;font:13px/1.35 system-ui,Microsoft YaHei,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.35);cursor:default';
            document.body.appendChild(button);
        }
        button.textContent = text;
        button.hidden = false;
        button.onclick = typeof retry === 'function' ? retry : null;
        button.style.cursor = retry ? 'pointer' : 'default';
        clearTimeout(button._hideTimer);
        if (kind === 'success') {
            button._hideTimer = setTimeout(function() { button.hidden = true; }, 1600);
        }
    }

    function localAvailable() {
        try {
            var probe = LOCAL_KEY + ':probe';
            root.localStorage.setItem(probe, '1');
            root.localStorage.removeItem(probe);
            return true;
        } catch (_) {
            return false;
        }
    }

    function loadLocal() {
        if (!localAvailable()) return Object.create(null);
        try {
            var value = JSON.parse(root.localStorage.getItem(LOCAL_KEY) || '{}');
            return value && typeof value === 'object' ? value : Object.create(null);
        } catch (_) {
            return Object.create(null);
        }
    }

    function saveLocal() {
        if (!localAvailable()) return;
        try { root.localStorage.setItem(LOCAL_KEY, JSON.stringify(cache)); } catch (_) {}
    }

    function tokenFor(key) {
        var hash = 5381;
        for (var i = 0; i < key.length; i++) hash = ((hash << 5) + hash) ^ key.charCodeAt(i);
        return (hash >>> 0).toString(36) + '-' + key.length.toString(36);
    }

    function dataKey(token, part) {
        return DATA_PREFIX + token + ':' + part;
    }

    function chunks(value) {
        var result = [];
        for (var offset = 0; offset < value.length; offset += CHUNK_SIZE) {
            result.push(value.slice(offset, offset + CHUNK_SIZE));
        }
        return result.length ? result : [''];
    }

    function mark(key) {
        dirty[key] = true;
    }

    async function waitForBridge() {
        if (!root.__xrkxqDzmmBridgeReady) return;
        try { await timeout(root.__xrkxqDzmmBridgeReady, 2500, 'BRIDGE_READY_TIMEOUT'); } catch (_) {}
    }

    async function preload() {
        await waitForBridge();
        var api = sdk();
        if (!api) {
            cache = loadLocal();
            return true;
        }
        var currentGeneration = generation;
        try {
            status('syncing', '正在读取云存档…');
            var indexResult = await timeout(api.kv.get(INDEX_KEY), 4000, 'SAVE_INDEX_TIMEOUT');
            var value = indexResult && indexResult.value;
            var entries = value && value.entries;
            if (!entries || typeof entries !== 'object') entries = Object.create(null);
            var loaded = Object.create(null);
            var keys = Object.keys(entries);
            await timeout(Promise.all(keys.map(async function(key) {
                var meta = entries[key];
                if (!meta || !meta.token || !meta.chunks) return;
                var requests = [];
                for (var part = 0; part < meta.chunks; part++) requests.push(api.kv.get(dataKey(meta.token, part)));
                var parts = await Promise.all(requests);
                loaded[key] = parts.map(function(item) {
                    return item && typeof item.value === 'string' ? item.value : '';
                }).join('');
            })), 6000, 'SAVE_DATA_TIMEOUT');
            if (!enabled || currentGeneration !== generation) return false;
            index = entries;
            cache = loaded;
            status('success', keys.length ? '云存档已载入' : '云存档已连接');
            return true;
        } catch (error) {
            console.warn('[XRKXQ save] cloud load failed', error);
            cache = loadLocal();
            index = Object.create(null);
            status('error', '云存档读取失败，点击重试', function() { root.location.reload(); });
            return false;
        }
    }

    function flush(critical) {
        if (!enabled) return Promise.resolve(false);
        var changed = Object.keys(dirty);
        if (!changed.length) return flushChain.catch(function() { return false; });
        changed.forEach(function(key) { delete dirty[key]; });
        var api = sdk();
        if (!api) {
            saveLocal();
            return Promise.resolve(true);
        }
        var currentGeneration = generation;
        status('syncing', critical ? '正在同步云存档…' : '正在保存…');
        var operation = flushChain.catch(function() {}).then(async function() {
            if (!enabled || currentGeneration !== generation) return false;
            for (var i = 0; i < changed.length; i++) {
                var key = changed[i];
                var previous = index[key];
                var value = cache[key];
                if (typeof value === 'string') {
                    var token = previous && previous.token || tokenFor(key);
                    var pieces = chunks(value);
                    for (var part = 0; part < pieces.length; part++) {
                        await api.kv.put(dataKey(token, part), pieces[part], critical ? { flush: true } : undefined);
                    }
                    if (previous && previous.chunks > pieces.length) {
                        for (var stale = pieces.length; stale < previous.chunks; stale++) {
                            await api.kv.delete(dataKey(token, stale));
                        }
                    }
                    index[key] = { token: token, chunks: pieces.length };
                } else if (previous) {
                    for (var removed = 0; removed < previous.chunks; removed++) {
                        await api.kv.delete(dataKey(previous.token, removed));
                    }
                    delete index[key];
                }
            }
            await api.kv.put(INDEX_KEY, { version: 1, entries: index }, critical ? { flush: true } : undefined);
            return true;
        }).then(function(result) {
            if (enabled && currentGeneration === generation) status('success', '云存档已同步');
            return result;
        }).catch(function(error) {
            changed.forEach(mark);
            console.warn('[XRKXQ save] cloud write failed', error);
            if (enabled && currentGeneration === generation) {
                status('error', '云存档同步失败，点击重试', function() { flush(true).catch(function() {}); });
            }
            throw error;
        });
        flushChain = operation;
        return operation;
    }

    function schedule(critical) {
        if (flushTimer) clearTimeout(flushTimer);
        if (critical) {
            // RMMV writes the slot, global metadata and common save in one
            // synchronous call stack. Defer one task so the critical flush
            // captures that complete transaction rather than only the slot.
            flushTimer = setTimeout(function() {
                flushTimer = 0;
                flush(true).catch(function() {});
            }, 0);
            return Promise.resolve(true);
        }
        flushTimer = setTimeout(function() {
            flushTimer = 0;
            flush(false).catch(function() {});
        }, 300);
    }

    function storageKey(savefileId) {
        return root.StorageManager.webStorageKey(savefileId);
    }

    function installStorage() {
        var manager = root.StorageManager;
        if (!manager || manager._xrkxqKvStorage) return;
        manager.isLocalMode = function() { return false; };
        manager.save = function(savefileId, json) {
            if (!enabled) return;
            var key = storageKey(savefileId);
            cache[key] = LZString.compressToBase64(json);
            mark(key);
            schedule(savefileId > 0);
        };
        manager.load = function(savefileId) {
            var data = cache[storageKey(savefileId)];
            return data ? migrateTutorialSaveJson(LZString.decompressFromBase64(data)) : null;
        };
        manager.exists = function(savefileId) { return !!cache[storageKey(savefileId)]; };
        manager.remove = function(savefileId) {
            var key = storageKey(savefileId);
            delete cache[key];
            mark(key);
            schedule(true);
        };
        manager.backup = function(savefileId) {
            var key = storageKey(savefileId);
            if (!cache[key]) return;
            cache[key + 'bak'] = cache[key];
            mark(key + 'bak');
        };
        manager.backupExists = function(savefileId) { return !!cache[storageKey(savefileId) + 'bak']; };
        manager.cleanBackup = function(savefileId) {
            var key = storageKey(savefileId) + 'bak';
            delete cache[key];
            mark(key);
            schedule(false);
        };
        manager.restoreBackup = function(savefileId) {
            var key = storageKey(savefileId);
            if (!cache[key + 'bak']) return;
            cache[key] = cache[key + 'bak'];
            delete cache[key + 'bak'];
            mark(key);
            mark(key + 'bak');
            schedule(true);
        };
        manager.saveCommonSave = function(json) {
            cache['RPG Common'] = LZString.compressToBase64(json);
            mark('RPG Common');
            schedule(true);
        };
        manager.loadCommonSave = function() {
            var data = cache['RPG Common'];
            return data ? LZString.decompressFromBase64(data) : null;
        };
        manager.existsCommonSave = function() { return !!cache['RPG Common']; };
        manager.removeCommonSave = function() {
            delete cache['RPG Common'];
            mark('RPG Common');
            schedule(true);
        };
        manager._xrkxqKvStorage = true;
    }

    function installSaveAction() {
        var api = sdk();
        if (saveActionInstalled || !api || !api.save || typeof api.save.onAction !== 'function') return;
        saveActionInstalled = true;
        api.save.onAction(async function(request) {
            if (!request || (request.action !== 'reset' && request.action !== 'prepareDeleteRecord')) {
                return { ok: false, code: 'unsupported' };
            }
            var oldCache = cache;
            var oldIndex = index;
            var oldDirty = dirty;
            enabled = false;
            generation += 1;
            if (flushTimer) clearTimeout(flushTimer);
            try {
                await flushChain.catch(function() {});
                var deletes = [api.kv.delete(INDEX_KEY)];
                Object.keys(oldIndex).forEach(function(key) {
                    var meta = oldIndex[key];
                    for (var part = 0; part < meta.chunks; part++) deletes.push(api.kv.delete(dataKey(meta.token, part)));
                });
                await timeout(Promise.all(deletes), 20000, 'SAVE_DELETE_TIMEOUT');
                cache = Object.create(null);
                index = Object.create(null);
                dirty = Object.create(null);
                status('success', '云存档已清空');
                return request.action === 'reset' ? { ok: true, reload: true } : { ok: true };
            } catch (error) {
                cache = oldCache;
                index = oldIndex;
                dirty = oldDirty;
                enabled = true;
                status('error', '云存档清空失败');
                throw error;
            }
        });
    }

    function installReadyHook() {
        if (!root.SceneManager || root.SceneManager._xrkxqReadyHook) return;
        var original = root.SceneManager.onSceneStart;
        root.SceneManager.onSceneStart = function() {
            original.apply(this, arguments);
            var scene = this._scene;
            if ((root.Scene_Title && scene instanceof root.Scene_Title) || (root.Scene_Map && scene instanceof root.Scene_Map)) {
                var api = sdk();
                if (api && api.loading && typeof api.loading.ready === 'function') api.loading.ready();
            }
        };
        root.SceneManager._xrkxqReadyHook = true;
    }

    root.addEventListener('pagehide', function() { flush(false).catch(function() {}); });
    root.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') flush(false).catch(function() {});
    });

    root.XRKXQSaveAdapter = {
        initialize: async function() {
            var api = sdk();
            if (api && api.loading && typeof api.loading.progress === 'function') {
                api.loading.progress({ phase: 'runtime_initializing', loadedResources: 10, totalResources: 100, currentResource: 'cloud-saves' });
            }
            await preload();
            installStorage();
            installTutorialSaveMigration();
            installSaveAction();
            installReadyHook();
            return true;
        },
        flush: flush
    };
})();
