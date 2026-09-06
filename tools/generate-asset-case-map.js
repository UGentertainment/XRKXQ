const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function collect(baseDir, extensions, keyForDirectory) {
    const result = {};
    const absoluteBase = path.join(root, baseDir);
    for (const entry of fs.readdirSync(absoluteBase, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const directory = path.join(absoluteBase, entry.name);
        const files = fs.readdirSync(directory, { withFileTypes: true });
        const values = {};
        for (const file of files) {
            if (!file.isFile()) continue;
            const extension = path.extname(file.name).toLowerCase();
            if (!extensions.includes(extension)) continue;
            const basename = file.name.slice(0, -extension.length);
            values[basename.toLowerCase()] = basename;
        }
        result[keyForDirectory(entry.name)] = values;
    }
    return result;
}

const manifest = {
    image: collect('img', ['.rpgmvp', '.png', '.jpg', '.jpeg', '.webp'], name => 'img/' + name.toLowerCase() + '/'),
    audio: collect('audio', ['.rpgmvo', '.ogg', '.m4a'], name => name.toLowerCase())
};

const output = '(function(){window.XRKXQ_ASSET_CASE_MAP=' + JSON.stringify(manifest) + ';})();\n';
fs.writeFileSync(path.join(root, 'js', 'dzmm-asset-case-map.js'), output, 'utf8');
console.log('generated js/dzmm-asset-case-map.js (' + Buffer.byteLength(output) + ' bytes)');
