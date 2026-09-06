/*:
 * @plugindesc Web/iframe compatibility guard for FTKR extended message and choice windows.
 * @author DZMM
 *
 * This file intentionally affects Window_ChoiceListEx only.  The game's normal
 * choice windows (including the name confirmation at the beginning) keep the
 * original RPG Maker MV behaviour.
 */
(function() {
    'use strict';

    if (typeof Window_ChoiceListEx === 'undefined' ||
            typeof Window_MessageEx === 'undefined') {
        return;
    }

    // MessageWindowPopup added this field to Game_System.  Saves restored from
    // another build (including KV/cloud saves) can legitimately lack it.
    // Its original set/get/clear methods index the field without checking it,
    // which aborts the event immediately before the extended popup is shown.
    function ensurePopupState(gameSystem) {
        if (!Array.isArray(gameSystem._messagePopupCharacterIds)) {
            gameSystem._messagePopupCharacterIds = [];
        }
    }

    if (typeof Game_System !== 'undefined' &&
            typeof Game_System.prototype.setMessagePopupEx === 'function') {
        var originalSetMessagePopupEx = Game_System.prototype.setMessagePopupEx;
        Game_System.prototype.setMessagePopupEx = function(windowId, eventId) {
            ensurePopupState(this);
            return originalSetMessagePopupEx.apply(this, arguments);
        };

        var originalGetMessagePopupIdEx = Game_System.prototype.getMessagePopupIdEx;
        Game_System.prototype.getMessagePopupIdEx = function(windowId) {
            ensurePopupState(this);
            return originalGetMessagePopupIdEx.apply(this, arguments);
        };

        var originalClearMessagePopupEx = Game_System.prototype.clearMessagePopupEx;
        Game_System.prototype.clearMessagePopupEx = function(windowId) {
            ensurePopupState(this);
            return originalClearMessagePopupEx.apply(this, arguments);
        };

        var originalClearMessagePopup = Game_System.prototype.clearMessagePopup;
        Game_System.prototype.clearMessagePopup = function() {
            ensurePopupState(this);
            return originalClearMessagePopup.apply(this, arguments);
        };
    }

    var originalChoiceStart = Window_ChoiceListEx.prototype.start;

    function report(stage, error, choiceWindow) {
        window.__DZMM_CHOICE_DIAGNOSTICS__ = {
            stage: stage,
            message: error ? String(error.message || error) : '',
            windowId: choiceWindow && choiceWindow._windowId,
            choices: choiceWindow && choiceWindow._gameMessage ?
                choiceWindow._gameMessage.choices().slice() : []
        };
        if (error && window.console && console.warn) {
            console.warn('[DZMM] Recovered extended choice window:', error);
        }
    }

    function recoverChoiceWindow(choiceWindow) {
        var gameMessage = choiceWindow._gameMessage;
        var choices = gameMessage && gameMessage.choices();
        if (!choices || !choices.length) return false;

        var rows = Math.max(1, Math.min(choices.length, 8));
        var invalidWidth = !isFinite(choiceWindow.width) || choiceWindow.width <= 0;
        var invalidHeight = !isFinite(choiceWindow.height) || choiceWindow.height <= 0;

        if (invalidWidth) {
            var wantedWidth = 240;
            try {
                wantedWidth = choiceWindow.maxChoiceWidth() + choiceWindow.padding * 2;
            } catch (e) {
                report('measure-width', e, choiceWindow);
            }
            choiceWindow.width = Math.max(96, Math.min(wantedWidth, Graphics.boxWidth));
        }
        if (invalidHeight) {
            choiceWindow.height = choiceWindow.fittingHeight(rows);
        }

        // Popup linkage may place an extended sub-window outside a small iframe.
        choiceWindow.x = Number(choiceWindow.x);
        choiceWindow.y = Number(choiceWindow.y);
        if (!isFinite(choiceWindow.x)) choiceWindow.x = 0;
        if (!isFinite(choiceWindow.y)) choiceWindow.y = 0;
        choiceWindow.x = Math.max(0, Math.min(choiceWindow.x,
            Math.max(0, Graphics.boxWidth - choiceWindow.width)));
        choiceWindow.y = Math.max(0, Math.min(choiceWindow.y,
            Math.max(0, Graphics.boxHeight - choiceWindow.height)));

        try {
            if (!choiceWindow.contents ||
                    choiceWindow.contents.width !== choiceWindow.contentsWidth() ||
                    choiceWindow.contents.height !== choiceWindow.contentsHeight()) {
                choiceWindow.createContents();
            }
            choiceWindow.refresh();
        } catch (e) {
            // Geometry and input are still recovered even if a custom skin cannot draw.
            report('refresh', e, choiceWindow);
        }

        if (choiceWindow.index() < 0 || choiceWindow.index() >= choices.length) {
            var defaultIndex = Number(gameMessage.choiceDefaultType());
            choiceWindow.select(defaultIndex >= 0 && defaultIndex < choices.length ?
                defaultIndex : 0);
        }
        choiceWindow.visible = true;
        choiceWindow.contentsOpacity = 255;
        choiceWindow.open();
        choiceWindow.activate();
        return true;
    }

    Window_ChoiceListEx.prototype.start = function() {
        try {
            originalChoiceStart.apply(this, arguments);
        } catch (e) {
            report('start', e, this);
        }
        recoverChoiceWindow(this);
    };

    // If a custom popup skin or popup target still fails inside a restricted
    // iframe, show the same text in a regular extended message window.  This
    // keeps the event alive and lets its following choice window start.
    var originalExtendedStartMessage = Window_MessageEx.prototype.startMessage;
    Window_MessageEx.prototype.startMessage = function() {
        try {
            return originalExtendedStartMessage.apply(this, arguments);
        } catch (e) {
            report('message-start', e, this);
            this._targetCharacterId = null;
            this._textState = {
                index: 0,
                text: this.convertEscapeCharacters(this._gameMessage.allText())
            };
            this.padding = this.standardPadding();
            this.width = this.windowWidth();
            this.height = this.windowHeight();
            this.newPage(this._textState);
            this._positionType = this._gameMessage.positionType();
            this.x = 0;
            this.y = this._positionType * (Graphics.boxHeight - this.height) / 2;
            this.updateBackground();
            this.visible = true;
            this.contentsOpacity = 255;
            this.open();
            this.activate();
        }
    };

    // Some embedded browsers briefly report the popup target as unavailable.
    // Re-check while the extended message is waiting for its choice input.
    var originalMessageUpdate = Window_MessageEx.prototype.update;
    Window_MessageEx.prototype.update = function() {
        originalMessageUpdate.apply(this, arguments);
        if (this._gameMessage && this._gameMessage.isChoice() && this._choiceWindow &&
                (!this._choiceWindow.active || !this._choiceWindow.visible ||
                 this._choiceWindow.openness <= 0)) {
            recoverChoiceWindow(this._choiceWindow);
        }
    };
})();
