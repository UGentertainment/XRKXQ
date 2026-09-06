const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const english = /[A-Za-z]{2,}/;

function visibleText(value) {
    return String(value || '')
        .replace(/\\[A-Za-z]+(?:\[[^\]]*\])?/g, '')
        .replace(/\\[{}.$|!><^]/g, '')
        .replace(/https?:\/\/\S+/g, '');
}
const rows = [];

function add(file, where, value) {
    if (typeof value === 'string' && english.test(visibleText(value))) {
        rows.push({ file, where, value });
    }
}

function scanCommands(file, prefix, list) {
    if (!Array.isArray(list)) return;
    list.forEach((command, index) => {
        if (!command) return;
        if (command.code === 401 || command.code === 405) {
            add(file, `${prefix}.list[${index}]`, command.parameters[0]);
        } else if (command.code === 102) {
            (command.parameters[0] || []).forEach((choice, choiceIndex) =>
                add(file, `${prefix}.list[${index}].choices[${choiceIndex}]`, choice));
        }
    });
}

for (const name of fs.readdirSync(dataDir).filter(name => name.endsWith('.json'))) {
    const file = path.join(dataDir, name);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (name === 'CommonEvents.json') {
        data.forEach((event, id) => event && scanCommands(name, `common[${id}]`, event.list));
    } else if (/^Map\d+\.json$/.test(name)) {
        add(name, 'displayName', data.displayName);
        (data.events || []).forEach((event, eventId) => {
            if (!event) return;
            (event.pages || []).forEach((page, pageId) =>
                scanCommands(name, `event[${eventId}].page[${pageId}]`, page.list));
        });
    } else if (Array.isArray(data)) {
        data.forEach((entry, id) => {
            if (!entry || typeof entry !== 'object') return;
            for (const key of ['name', 'description', 'message1', 'message2', 'message3', 'message4']) {
                add(name, `[${id}].${key}`, entry[key]);
            }
        });
    } else if (name === 'System.json') {
        (data.terms && data.terms.basic || []).forEach((v, i) => add(name, `terms.basic[${i}]`, v));
        (data.terms && data.terms.commands || []).forEach((v, i) => add(name, `terms.commands[${i}]`, v));
        Object.entries(data.terms && data.terms.messages || {}).forEach(([k, v]) => add(name, `terms.messages.${k}`, v));
    }
}

const unique = new Map();
for (const row of rows) {
    if (!unique.has(row.value)) unique.set(row.value, { value: row.value, count: 0, examples: [] });
    const item = unique.get(row.value);
    item.count++;
    if (item.examples.length < 3) item.examples.push(`${row.file}:${row.where}`);
}

const result = [...unique.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
console.log(JSON.stringify({ occurrences: rows.length, unique: result.length, strings: result }, null, 2));
