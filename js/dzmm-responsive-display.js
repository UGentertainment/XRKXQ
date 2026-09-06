/* Make the fixed-resolution RMMV canvas fill the available iframe/fullscreen. */
(function() {
    'use strict';

    Graphics._defaultStretchMode = function() {
        return true;
    };

    function fitGame() {
        if (!Graphics || !Graphics._updateAllElements || !Graphics._errorPrinter ||
                !Graphics._canvas || !Graphics._video || !Graphics._upperCanvas) return;
        Graphics._stretchEnabled = true;
        Graphics._updateAllElements();
    }

    function scheduleFit() {
        window.requestAnimationFrame(fitGame);
        window.setTimeout(fitGame, 80);
        window.setTimeout(fitGame, 300);
    }

    window.addEventListener('resize', scheduleFit, false);
    window.addEventListener('orientationchange', scheduleFit, false);
    document.addEventListener('fullscreenchange', scheduleFit, false);
    document.addEventListener('webkitfullscreenchange', scheduleFit, false);

    window.XRKXQ_RESPONSIVE_DISPLAY = true;
})();
