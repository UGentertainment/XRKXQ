(function() {
    'use strict';
    if (!window.ImageManager || ImageManager._xrkxqCaseSensitiveAssets) return;

    var manifest = window.XRKXQ_ASSET_CASE_MAP || { image: {}, audio: {} };

    if (window.Decrypter && Decrypter.extToEncryptExt) {
        var originalEncryptedExtension = Decrypter.extToEncryptExt;
        Decrypter.extToEncryptExt = function(url) {
            var cleanUrl = String(url || '').split('?')[0];
            return originalEncryptedExtension.call(this, cleanUrl) + '?v=20260906-21';
        };
    }

    var originalLoadBitmap = ImageManager.loadBitmap;
    ImageManager.loadBitmap = function(folder, filename, hue, smooth) {
        var folderKey = String(folder || '').replace(/\\/g, '/').toLowerCase();
        var directory = manifest.image[folderKey];
        if (directory && filename != null) {
            filename = directory[String(filename).toLowerCase()] || filename;
        }
        return originalLoadBitmap.call(this, folder, filename, hue, smooth);
    };

    var originalLoadSystem = ImageManager.loadSystem;
    ImageManager.loadSystem = function(filename, hue) {
        var key = String(filename || '').toLowerCase();
        if (key === 'window2') filename = 'Window2';
        if (key === 'window3') filename = 'Window3';
        return originalLoadSystem.call(this, filename, hue);
    };

    if (window.AudioManager && AudioManager.createBuffer) {
        var originalCreateBuffer = AudioManager.createBuffer;
        AudioManager.createBuffer = function(folder, name) {
            var directory = manifest.audio[String(folder || '').toLowerCase()];
            if (directory && name != null) name = directory[String(name).toLowerCase()] || name;
            return originalCreateBuffer.call(this, folder, name);
        };
    }
    ImageManager._xrkxqCaseSensitiveAssets = true;
})();
