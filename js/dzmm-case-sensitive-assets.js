(function() {
    'use strict';
    if (!window.ImageManager || ImageManager._xrkxqCaseSensitiveAssets) return;

    var originalLoadSystem = ImageManager.loadSystem;
    ImageManager.loadSystem = function(filename, hue) {
        var key = String(filename || '').toLowerCase();
        if (key === 'window2') filename = 'Window2';
        if (key === 'window3') filename = 'Window3';
        return originalLoadSystem.call(this, filename, hue);
    };
    ImageManager._xrkxqCaseSensitiveAssets = true;
})();
