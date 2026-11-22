// The cells of an HTML table from the clipboard of another spreadsheet program. Excel and Google
// Sheets put the exact value of a cell next to its formatted text: Excel in `x:num` and `x:bool`,
// Google Sheets in `data-sheets-value`. So a paste gets 1234.5, not the text "1.234,50 €".
//
// The result is [[{input, raw}]], or null when the HTML has no table. `raw` is true for an input
// that is canonical already; the other inputs are text in the form of the locale of the person.
export function readClipboardTable(html) {
    if (!html || !/<table[\s>]/i.test(html) || typeof DOMParser === 'undefined') { return null; }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) { return null; }
    const rows = [];
    for (const tr of table.querySelectorAll('tr')) {
        const row = [];
        for (const cell of tr.querySelectorAll('td, th')) {
            const item = readCell(cell);
            row.push(item);
            const span = Math.min(256, Number(cell.getAttribute('colspan')) || 1);
            for (let i = 1; i < span; i++) { row.push({input: '', raw: true}); }
        }
        rows.push(row);
    }
    if (!rows.length) { return null; }
    const width = Math.max(...rows.map(row => row.length));
    return rows.map(row => [...row, ...Array.from({length: width - row.length}, () => ({input: '', raw: true}))]);
}

function readCell(cell) {
    // The text as the person sees it, with a line break for <br>
    const text = textOf(cell);
    const sheets = cell.getAttribute('data-sheets-value');
    if (sheets) {
        try {
            const data = JSON.parse(sheets);
            // Google Sheets: 1 is the kind. 2 is text, 3 is a number, 4 is a boolean.
            if (data[1] === 3 && typeof data[3] === 'number') { return {input: String(data[3]), raw: true}; }
            if (data[1] === 4) { return {input: data[4] ? 'TRUE' : 'FALSE', raw: true}; }
            if (data[1] === 2 && typeof data[2] === 'string') { return {input: keepText(data[2]), raw: true}; }
        } catch { /* Not the JSON of Google Sheets */ }
    }
    if (cell.hasAttribute('x:num')) {
        const value = cell.getAttribute('x:num');
        if (value && Number.isFinite(Number(value))) { return {input: String(Number(value)), raw: true}; }
    }
    if (cell.hasAttribute('x:bool')) {
        const value = (cell.getAttribute('x:bool') || text).trim().toUpperCase();
        if (value === 'TRUE' || value === 'FALSE') { return {input: value, raw: true}; }
    }
    if (cell.hasAttribute('x:str')) { return {input: keepText(cell.getAttribute('x:str') || text), raw: true}; }
    return {input: text, raw: false};
}

// A text stays a text: it does not become a number or a formula
const keepText = (text) => (/^[=']/.test(text) || /^[-+]?[\d.,]+%?$/.test(text.trim()) ? `'${text}` : text);

function textOf(cell) {
    let out = '';
    const walk = (node) => {
        for (const child of node.childNodes) {
            if (child.nodeType === 3) { out += child.nodeValue; } else if (child.nodeName === 'BR') { out += '\u0000'; } else if (child.nodeType === 1) { walk(child); }
        }
    };
    walk(cell);
    // HTML turns runs of spaces and line breaks into one space. A <br> is a line break.
    return out.replace(/\s+/g, ' ').replace(/ ?\u0000 ?/g, '\n').trim();
}
