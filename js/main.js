//=============================================================================
// main.js
//=============================================================================

PluginManager.setup($plugins);

window.onload = function() {
    var initialize = window.XRKXQSaveAdapter ? window.XRKXQSaveAdapter.initialize() : Promise.resolve();
    initialize.then(function() {
        SceneManager.run(Scene_Boot);
    }).catch(function(error) {
        console.error(error);
        SceneManager.run(Scene_Boot);
    });
};
