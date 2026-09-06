/*
 * Hide the male protagonist's dialogue portraits in the web build.
 *
 * Event data uses names such as Protagonist_0000 and
 * Protagonist 1_0000.  Returning a ready transparent bitmap keeps the
 * picture-animation and message event flow intact without displaying them.
 */
(function() {
    'use strict';

    var protagonistPortrait = /^Protagonist(?:\s+\d+)?_(?:\d{4})$/i;
    var protagonistAuxiliaryPortrait = /^Protagonist_(?:camera|faint_\d{4})$/i;
    var transparentBitmap = null;

    function isProtagonistPortrait(filename) {
        return protagonistPortrait.test(String(filename || '')) ||
            protagonistAuxiliaryPortrait.test(String(filename || ''));
    }

    function emptyBitmap() {
        if (!transparentBitmap) {
            transparentBitmap = new Bitmap(1, 1);
            transparentBitmap.smooth = true;
        }
        return transparentBitmap;
    }

    var originalLoadPicture = ImageManager.loadPicture;
    ImageManager.loadPicture = function(filename, hue) {
        if (isProtagonistPortrait(filename)) {
            return emptyBitmap();
        }
        return originalLoadPicture.call(this, filename, hue);
    };

    window.XRKXQ_PROTAGONIST_PORTRAITS_HIDDEN = true;
})();
