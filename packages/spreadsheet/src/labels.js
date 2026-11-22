// Row numbers in these messages start at 1, as they do in the grid.
const defaults = {
    corner: 'Rows and columns',
    keyboardHelp: 'Tab goes to the next cell. Press Escape, then Tab, to leave the sheet.',
    rowStates: {changed: 'changed, not sent', draft: 'new, not sent', empty: 'new row', pending: 'sending', sent: 'sent', error: 'not sent', conflict: 'changed here and elsewhere, not sent'},
    hints: {attention: 'Needs attention'},
    rowSending: row => `Row ${row} is sending`,
    rowSent: row => `Row ${row} was sent`,
    rowFailed: (row, error) => `Row ${row} was not sent: ${error}`,
    sendFailed: 'The send failed',
    rowInvalid: (row, count, problem) => `Row ${row} was not sent. ${count === 1 ? 'One cell has a problem' : `${count} cells have problems`}: ${problem}`,
    rowConflict: (row, fields) => `Row ${row} changed elsewhere: ${fields.join(', ')}`,
    conflictFields: fields => `Changed elsewhere: ${fields.join(', ')}`,
    conflictBlocked: row => `Row ${row} was not sent. It changed elsewhere. Keep your changes, or take the new version.`,
    lockedNotice: (address, count) => count === 1 ? `Cell ${address} is locked. You cannot change it.`
        : `${count} cells are locked, for example ${address}. Nothing changed.`,
    lockedSkipped: count => `${count} locked ${count === 1 ? 'cell' : 'cells'} did not change`,
    fixedStructure: 'In data entry, rows and columns do not change',
    blank: 'blank',
    cellSelected: ({address, content, formula, locked, invalid, hint}) =>
        `${address} ${content}${formula ? `, formula ${formula}` : ''}${locked ? ', locked' : ''}${invalid ? `, invalid: ${invalid}` : ''}${hint ? `, ${hint}` : ''}`,
    rangeSelected: (range, count, address, content) => `${range} selected, ${count} cells. ${address} ${content}`,
    columnWidth: (column, width) => `Column ${column} width ${width} pixels`,
    cutStopped: 'The cut stopped',
    leaveSheet: 'Press Tab to leave the sheet',
    readOnly: 'The sheet is read only',
    calendarTitle: 'Calendar (Alt+Arrow Down)',
    calendar: address => `Calendar for ${address}`,
    dateFor: address => `Date for ${address}`,
    calendarOpened: address => `Calendar for ${address}. Press Escape to close it.`,
    editCell: address => `Edit ${address}`,
    editing: address => `Editing ${address}`,
    reference: text => `Reference ${text}`,
    editMode: 'Edit mode: the arrow keys move in the text',
    enterMode: 'Enter mode: the arrow keys go to another cell',
    invalidEdit: message => `${message} Press Escape to cancel the edit.`,
    canceledEdit: address => `Edit of ${address} canceled`,
    cut: range => `Cut ${range}`,
    copied: range => `Copied ${range}`,
    pasted: range => `Pasted to ${range}`,
    pastedRows: (range, sent, held) => `Pasted to ${range}. ${sent} ${sent === 1 ? 'row' : 'rows'} sent${held ? `, ${held} with problems` : ''}`,
    argument: (name, argument) => `${name}, ${argument}`,
    cellAddress: 'Cell address',
    cellInput: 'Cell input',
    inputOf: address => `Input of cell ${address}`,
    options: title => `${title} options`,
    functions: 'Functions',
    column: name => `Column ${name}`,
    formulaError: code => `The formula gives ${code}.`,
    invalidValue: 'The value is not valid.',
};

export function sheetLabel(sheet, key, ...args) {
    const value = sheet?.labels?.[key] ?? defaults[key];
    return typeof value === 'function' ? value(...args) : value;
}

// A custom hint without a label uses its name.
export function namedLabel(sheet, group, name) {
    const labels = sheet.labels?.[group];
    if (labels && Object.hasOwn(labels, name)) { return labels[name]; }
    if (Object.hasOwn(defaults[group], name)) { return defaults[group][name]; }
    return group === 'hints' ? name : '';
}
