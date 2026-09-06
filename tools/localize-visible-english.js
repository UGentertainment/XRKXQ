const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');

function translate(value) {
    if (typeof value !== 'string') return value;
    const exact = {
        '(Sub)会いに行く？': '（支线）要去见她吗？',
        '風呂場(OPEV)': '浴室（开场事件）',
        '各場所Hシーン(Sub)': '各地点事件（支线）',
        '最初の設定(OP)': '初始设置（序章）',
        'EDスタッフロール': '结局制作人员名单',
        'MAP006': '地图006',
        'OP': '序章',
        'OP終わり': '序章结束',
        'aaaaaa': '未命名技能'
    };
    if (Object.prototype.hasOwnProperty.call(exact, value)) return exact[value];
    return value
        .replace(/イベントCLEAR!/g, '事件完成！')
        .replace(/アイテム/g, '物品')
        .replace(/GET!!/g, '获得！')
        .replace(/GET!/g, '获得！')
        .replace(/闪亮BOX/g, '闪亮宝箱')
        .replace(/奇怪的DVD/g, '奇怪的光盘')
        .replace(/DVD/g, '光盘')
        .replace(/BBQ/g, '烧烤')
        .replace(/Cosplay/g, '角色扮演')
        .replace(/体操服Cos/g, '体操服角色扮演')
        .replace(/变态play/g, '变态玩法')
        .replace(/Evening/g, '傍晚')
        .replace(/Rare([1-4])/g, '稀有度$1')
        .replace(/\bPt\b/g, '点')
        .replace(/pt/g, '点')
        .replace(/ED列表/g, '结局列表')
        .replace(/【 ED - /g, '【 结局 - ')
        .replace(/\bNo\.(\d+)/g, '编号$1')
        .replace(/Adios！\(西班牙语：再见\)/g, '再见！')
        .replace(/Do it Now！/g, '现在就做！')
        .replace(/Do it/g, '现在就做')
        .replace(/Apend/g, '追加内容')
        .replace(/apend/g, '追加内容')
        .replace(/有剧情的AV/g, '有剧情的成人影像')
        .replace(/BGM 音量/g, '背景音乐音量')
        .replace(/BGS 音量/g, '环境音音量')
        .replace(/CV 音量/g, '语音音量')
        .replace(/SE 音量/g, '音效音量')
        .replace(/([^\\])kw\[/g, '$1\\kw[');
}

function localizeCommands(list) {
    if (!Array.isArray(list)) return;
    for (const command of list) {
        if (!command) continue;
        if (command.code === 401 || command.code === 405) {
            command.parameters[0] = translate(command.parameters[0]);
        } else if (command.code === 102 && Array.isArray(command.parameters[0])) {
            command.parameters[0] = command.parameters[0].map(translate);
        }
    }
}

for (const name of fs.readdirSync(dataDir).filter(name => name.endsWith('.json'))) {
    const file = path.join(dataDir, name);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (name === 'CommonEvents.json') {
        data.forEach(event => event && localizeCommands(event.list));
    } else if (/^Map\d+\.json$/.test(name)) {
        data.displayName = translate(data.displayName);
        (data.events || []).forEach(event => event && (event.pages || []).forEach(page => localizeCommands(page.list)));
    } else if (Array.isArray(data)) {
        data.forEach(entry => {
            if (!entry || typeof entry !== 'object') return;
            for (const key of ['name', 'description', 'message1', 'message2', 'message3', 'message4']) {
                if (key in entry) entry[key] = translate(entry[key]);
            }
        });
    } else if (name === 'System.json') {
        const basic = data.terms.basic;
        basic[1] = '级';
        basic[3] = '体力';
        basic[5] = '精力';
        basic[7] = '技力';
        basic[9] = '经验';
        Object.keys(data.terms.messages).forEach(key => {
            data.terms.messages[key] = translate(data.terms.messages[key]);
        });
    }
    fs.writeFileSync(file, JSON.stringify(data), 'utf8');
}

console.log('Localized visible English strings in data/*.json');
