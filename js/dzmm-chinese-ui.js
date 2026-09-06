/* Keep browser-facing system UI in Simplified Chinese. */
(function() {
    'use strict';

    var originalOnLoad = DataManager.onLoad;
    DataManager.onLoad = function(object) {
        originalOnLoad.call(this, object);
        if (object === window.$dataSystem && object && object.terms) {
            object.terms.commands[18] = '新的游戏';
            object.terms.commands[19] = '继续游戏';
            object.terms.commands[20] = '设置';
            object.terms.commands[21] = '回到标题';
            object.terms.messages.bgmVolume = '背景音乐音量';
            object.terms.messages.bgsVolume = '环境音音量';
            object.terms.messages.meVolume = '语音音量';
            object.terms.messages.seVolume = '音效音量';
        }
    };

    Window_TitleCommand.prototype.makeCommandList = function() {
        this.addCommand('新的游戏', 'newGame');
        this.addCommand('继续游戏', 'continue', this.isContinueEnabled());
        this.addCommand('设置', 'options');
    };

    Window_TitleCommand.prototype.drawItem = function(index) {
        var rect = this.itemRectForText(index);
        var names = {
            newGame: '新的游戏',
            continue: '继续游戏',
            options: '设置'
        };
        this.resetTextColor();
        this.changePaintOpacity(this.isCommandEnabled(index));
        this.drawText(names[this.commandSymbol(index)] || this.commandName(index),
            rect.x, rect.y, rect.width, this.itemTextAlign());
    };

    window.XRKXQ_CHINESE_UI = true;
})();
