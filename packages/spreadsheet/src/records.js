// The rows of a sheet for data entry. The design is in the README, at "Data Entry".
//
// The sheet shows two kinds of rows. A record row shows one object of `records`, the data of the
// application. An entry row is a new row that the person fills. A row that the person changes is
// apart from the data until the application has it: new data from outside the sheet does not
// change it, so the work of the person is not lost. The rows that the person does not change
// follow the data at once.
//
// The state of a row:
//   clean    a record row that shows its record
//   changed  a record row that the person changed, not sent
//   empty    an entry row with no input
//   draft    an entry row with input, not sent
//   pending  sent with onSubmitRow, and the answer did not come yet. The row is locked.
//   sent     the answer came. An entry row stays, locked, until its record is in `records`.
//   error    the send failed. The row stays, and the person can change it and send it again.

import { sheetLabel } from './labels.js';

const SANDBOXED = new Set(['changed', 'pending', 'error']);

export class RecordRows {
    rows = [];
    records = [];
    #host;
    #conflicts = [];

    constructor(host) {
        this.#host = host;
    }

    get active() { return true; }

    stateOf(row) { return this.rows[row]?.state ?? null; }

    // ---------- Conflicts ----------

    // A record row that the person changed, while a new version of its record came from outside:
    // {original, incoming, fields}. `fields` are the keys that the new version changed. null when
    // there is no conflict.
    conflictOf(row) {
        const item = this.rows[row];
        if (!item || item.kind !== 'record' || !item.incoming || !(item.state === 'changed' || item.state === 'error')) { return null; }
        const host = this.#host;
        const fields = [];
        for (const {key, col, formula, hidden} of host.columns()) {
            if (formula || key === undefined || key === null) { continue; }
            if (hidden && host.inputAt(row, col) === host.inputOf(item.record?.[key], col)) { continue; }
            if (host.inputOf(item.incoming[key], col) !== host.inputOf(item.record?.[key], col)) { fields.push(key); }
        }
        return fields.length ? {original: item.record, incoming: item.incoming, fields} : null;
    }

    // The state for the row header: 'conflict' for a row with a conflict, when the sheet shows them
    shownStateOf(row) {
        const state = this.stateOf(row);
        return this.#host.showConflicts() && this.conflictOf(row) ? 'conflict' : state;
    }

    // Keeps the changes of the person on top of the new version: the new version becomes the
    // original of the row, the fields that the person did not change take its values, and the row can go
    keepMine(row) {
        const item = this.rows[row];
        const conflict = this.conflictOf(row);
        if (!conflict) { return false; }
        // A field that the person did not change takes the new version. A field that both changed
        // keeps the text of the person.
        const host = this.#host;
        const writes = [];
        for (const {key, col, formula} of host.columns()) {
            if (formula || key == null) { continue; }
            if (host.inputAt(row, col) === host.inputOf(conflict.original?.[key], col)) {
                writes.push({row, col, input: host.inputOf(conflict.incoming[key], col)});
            }
        }
        if (writes.length) { host.write(writes); }
        item.record = item.incoming;
        item.incoming = null;
        if (this.#matches(row, item.record)) { item.state = 'clean'; }
        this.#host.rowsChanged();
        return true;
    }

    rowInfo(row) { return this.rows[row] ?? null; }

    // A row that the person cannot change now
    isBusy(row) {
        const item = this.rows[row];
        return Boolean(item) && (item.state === 'pending' || (item.kind === 'entry' && item.state === 'sent'));
    }

    #idOf(record, index) {
        const id = record?.[this.#host.recordKey()];
        return id === undefined || id === null ? `#${index}` : id;
    }

    // ---------- Data from outside ----------

    // Shows the records. The rows that the person changed stay as they are.
    setRecords(list) {
        const records = Array.isArray(list) ? list : [];
        this.records = records;
        const host = this.#host;
        const old = this.rows;
        const editing = host.editingRow();
        const byId = new Map();
        const sentById = new Map();
        old.forEach((item, index) => {
            if (item.kind === 'record') { byId.set(item.id, index); }
            // An entry row with an id: from newRecordId before the send, or from the answer
            if (item.kind === 'entry' && (item.state === 'sent' || item.state === 'pending') && item.sentId !== null && item.sentId !== undefined) { sentById.set(item.sentId, index); }
        });
        const ids = new Set();
        const next = [];
        const mapping = new Int32Array(old.length).fill(-1);
        const used = new Set();
        const writes = [];
        const conflicts = [];
        records.forEach((record, index) => {
            const id = this.#idOf(record, index);
            ids.add(id);
            const oldIndex = byId.get(id) ?? sentById.get(id);
            if (oldIndex === undefined || used.has(oldIndex)) {
                const item = {kind: 'record', id, record, state: 'clean'};
                writes.push({item, record});
                next.push(item);
                return;
            }
            used.add(oldIndex);
            const item = old[oldIndex];
            // A row that the person changed, or edits now, stays. The new record waits in `incoming`.
            const waiting = SANDBOXED.has(item.state) || oldIndex === editing || (item.state === 'sent' && item.kind === 'record' && item.record === record);
            if (item.kind === 'entry' && item.state === 'pending') {
                // The record came before the answer. The row waits for the answer.
                item.incoming = record;
            } else if (item.kind === 'entry') {
                // The record of a sent entry row arrived: the row becomes a record row
                item.kind = 'record';
                item.entry = false;
                item.id = id;
                item.record = record;
                item.state = 'clean';
                writes.push({item, record});
            } else if (waiting) {
                if (item.record !== record) {
                    item.incoming = record;
                    conflicts.push(item);
                }
            } else {
                if (item.record !== record || item.state !== 'clean') { writes.push({item, record}); }
                item.record = record;
                item.incoming = null;
                item.state = 'clean';
                item.error = null;
            }
            item.gone = false;
            item.id = id;
            mapping[oldIndex] = next.length;
            next.push(item);
        });
        // A changed record row whose record went away stays, so that the person can decide
        old.forEach((item, index) => {
            if (used.has(index) || item.kind !== 'record') { return; }
            if (SANDBOXED.has(item.state) || index === editing) {
                item.gone = true;
                mapping[index] = next.length;
                next.push(item);
            }
        });
        // The entry rows stay after the records. A sent row with no id goes now: its record is in
        // the new data, or the application did not keep it.
        old.forEach((item, index) => {
            if (used.has(index) || item.kind !== 'entry') { return; }
            if (item.state === 'sent' && (item.sentId === null || item.sentId === undefined)) { return; }
            // A record row shows this record already
            if (item.state === 'sent' && ids.has(item.sentId)) { return; }
            mapping[index] = next.length;
            next.push(item);
        });
        this.rows = next;
        this.#conflicts = conflicts;
        this.#addEntryRows(next, editing === -1 ? -1 : mapping[editing]);
        host.remap(mapping, Math.max(1, this.rows.length));
        if (writes.length) { this.#write(writes); }
        const written = new Set(writes.map(write => write.item));
        const formulaRows = [];
        this.rows.forEach((item, index) => {
            if (written.has(item) || item.fresh) { formulaRows.push(index); }
            item.fresh = false;
        });
        this.#writeFormulas(formulaRows);
        host.rowsChanged();
    }

    // Load each new field from the row's original record. A draft keeps the inputs
    // that the model moved, including fields outside the new view.
    *inputsForColumns(kept) {
        const host = this.#host;
        const columns = host.columns();
        for (const [row, item] of this.rows.entries()) {
            for (const column of columns) {
                const {key, col, formula} = column;
                if (formula) {
                    yield {row, col, input: host.formulaFor(column, row)};
                } else if (key != null && (item.state === 'clean' || !kept.has(col))) {
                    yield {row, col, input: host.inputOf(item.record?.[key], col)};
                }
            }
        }
    }

    // The entry rows at the end: `entryRows` empty rows after the last row with input
    #addEntryRows(rows, keep = -1) {
        const wanted = this.#host.entryRows();
        let empty = 0;
        for (let index = rows.length - 1; index >= 0 && rows[index].kind === 'entry' && rows[index].state === 'empty'; index--) { empty++; }
        while (empty < wanted) {
            rows.push({kind: 'entry', entry: true, id: null, record: null, state: 'empty', fresh: true});
            empty++;
        }
        // Too many empty rows at the end, for example after `entryRows` became smaller
        while (empty > wanted && rows.length && rows.at(-1).kind === 'entry' && rows.at(-1).state === 'empty' && rows.length - 1 !== keep) {
            rows.pop();
            empty--;
        }
    }

    // Writes the inputs of records, with no undo step
    #write(writes) {
        const host = this.#host;
        const columns = host.columns();
        const changes = [];
        const index = writes.length > 8 ? new Map(this.rows.map((item, at) => [item, at])) : null;
        for (const {item, record} of writes) {
            const row = index ? (index.get(item) ?? -1) : this.rows.indexOf(item);
            if (row < 0) { continue; }
            for (const {key, col} of columns) {
                if (key === undefined || key === null) { continue; }
                changes.push({row, col, input: host.inputOf(record?.[key], col)});
            }
        }
        if (changes.length) { host.write(changes); }
    }

    // The formula of each calculated column, in the rows
    #writeFormulas(rows) {
        const host = this.#host;
        const formulas = host.columns().filter(column => column.formula);
        if (!formulas.length || !rows.length) { return; }
        const changes = [];
        for (const row of rows) {
            for (const column of formulas) { changes.push({row, col: column.col, input: host.formulaFor(column, row)}); }
        }
        host.write(changes);
    }

    // More entry rows, for example for a paste of many lines. Returns true if rows were added.
    ensureRows(count) {
        const before = this.rows.length;
        while (this.rows.length < count) { this.rows.push({kind: 'entry', entry: true, id: null, record: null, state: 'empty'}); }
        if (this.rows.length === before) { return false; }
        this.#host.setRowCount(this.rows.length);
        this.#writeFormulas(Array.from({length: this.rows.length - before}, (_, i) => before + i));
        return true;
    }

    // ---------- Changes by the person ----------

    // After the person changed cells in these rows
    userChanged(rows, {submit = true} = {}) {
        const host = this.#host;
        let added = false;
        for (const row of rows) {
            const item = this.rows[row];
            if (!item) { continue; }
            if (item.kind === 'entry') {
                if (this.#isEmpty(row)) {
                    item.state = 'empty';
                } else if (item.state !== 'error') {
                    item.state = 'draft';
                }
            } else if (this.#matches(row, item.record)) {
                item.state = 'clean';
                item.error = null;
                if (item.incoming) { this.#apply(item); }
            } else if (item.state !== 'error') {
                item.state = 'changed';
            }
        }
        const before = this.rows.length;
        this.#addEntryRows(this.rows, host.editingRow());
        if (this.rows.length !== before) {
            host.setRowCount(this.rows.length);
            this.#writeFormulas(Array.from({length: Math.max(0, this.rows.length - before)}, (_, i) => before + i));
            added = true;
        }
        host.rowsChanged();
        if (submit) { for (const row of rows) { this.consider(row, 'change'); } }
        return added;
    }

    // The rows that got a new conflict in the last setRecords, once each
    takeConflicts() {
        const rows = [];
        for (const item of this.#conflicts) {
            const row = this.rows.indexOf(item);
            if (row >= 0 && item.toldConflict !== item.incoming && this.conflictOf(row)) {
                item.toldConflict = item.incoming;
                rows.push(row);
            }
        }
        this.#conflicts = [];
        return rows;
    }

    // An edit ended with no change: a record that waited goes into the row now
    editEnded(row) {
        const item = this.rows[row];
        if (item?.kind === 'record' && item.state === 'clean' && item.incoming) {
            this.#apply(item);
            this.#host.rowsChanged();
        }
    }

    #apply(item) {
        const record = item.incoming;
        item.incoming = null;
        item.record = record;
        this.#write([{item, record}]);
    }

    #isEmpty(row) {
        const host = this.#host;
        return host.columns().every(({key, col, formula}) => formula || key === undefined || key === null || host.inputAt(row, col) === '');
    }

    #matches(row, record) {
        const host = this.#host;
        return host.columns().every(({key, col, formula}) => formula || key === undefined || key === null || host.inputAt(row, col) === host.inputOf(record?.[key], col));
    }

    // Puts the row back as its record, or empties an entry row
    discard(row) {
        const item = this.rows[row];
        if (!item || this.isBusy(row)) { return false; }
        if (item.kind === 'entry') {
            const host = this.#host;
            host.write(host.columns().filter(column => !column.formula && column.key !== undefined && column.key !== null).map(({col}) => ({row, col, input: ''})));
            item.state = 'empty';
        } else {
            const record = item.incoming ?? item.record;
            item.incoming = null;
            item.record = record;
            this.#write([{item, record}]);
            item.state = 'clean';
        }
        item.error = null;
        this.#host.clearMarks(row);
        this.#host.rowsChanged();
        return true;
    }

    // ---------- Sending ----------

    // The values of a row, and a message for each problem: {record, errors, valid, empty}
    check(row, reason = 'check', problems = []) {
        const host = this.#host;
        const record = {};
        const errors = {};
        const item = this.rows[row];
        for (const {key, col, formula, hidden} of host.columns()) {
            if (key === undefined || key === null) { continue; }
            if (hidden && (formula || host.inputAt(row, col) === host.inputOf(item?.record?.[key], col))) { continue; }
            const result = host.parseCell(row, col);
            if (result.valid) {
                record[key] = result.value;
            } else {
                errors[key] = result.message;
                if (!hidden) { problems.push({row, col, message: result.message, reason: result.reason}); }
            }
        }
        if (!Object.keys(errors).length && host.validateRow()) {
            const extra = host.validateRow()(record, this.#context(row, reason, record));
            if (typeof extra === 'string' && extra) {
                errors[''] = extra;
            } else if (extra && typeof extra === 'object') {
                for (const [key, message] of Object.entries(extra)) {
                    if (!message) { continue; }
                    errors[key] = message;
                    const column = host.columns().find(item2 => item2.key === key);
                    if (column && !column.hidden) { problems.push({row, col: column.col, message, reason: 'row'}); }
                }
            }
        }
        const valid = Object.keys(errors).length === 0;
        return {record, errors, valid, empty: item?.kind === 'entry' && this.#isEmpty(row)};
    }

    #context(row, reason, record = null) {
        const item = this.rows[row];
        return {
            row,
            reason,
            kind: item?.kind === 'record' ? 'update' : 'new',
            id: item?.kind === 'record' ? item.id : null,
            original: item?.record ?? null,
            incoming: item?.incoming ?? null,
            conflict: this.conflictOf(row),
            gone: Boolean(item?.gone),
            record,
            sheet: this.#host.sheet,
        };
    }

    // Decides if a row goes now. reason: 'change', 'leave', 'enter', or 'manual'.
    consider(row, reason) {
        const item = this.rows[row];
        if (!item || !(item.state === 'draft' || item.state === 'changed' || item.state === 'error')) { return false; }
        const host = this.#host;
        const policy = host.submitOn();
        const wanted = reason === 'manual' || reason === 'paste'
            || policy === 'change'
            || (policy === 'leave-row' && (reason === 'leave' || reason === 'enter'))
            || (policy === 'enter' && reason === 'enter');
        const custom = host.submitWhen();
        if (!wanted && !custom) { return false; }
        if (this.#host.showConflicts() && this.conflictOf(row)) {
            // The person decides first: keep the changes, or take the new version
            if (reason !== 'change') { this.#host.say(sheetLabel(host.sheet, 'conflictBlocked', row + 1)); }
            return false;
        }
        const problems = [];
        const check = this.check(row, reason, problems);
        if (check.empty) { return false; }
        const context = {...this.#context(row, reason, check.record), errors: check.errors, valid: check.valid};
        // submitWhen decides when a row goes. A row with a problem never goes.
        const go = custom ? Boolean(custom(context)) : wanted;
        if (!go) { return false; }
        if (!check.valid) {
            if (problems.length && (reason !== 'change' || !host.quietRows())) { host.reportProblems(problems); }
            // A paste has one summary. A change shows marks without an announcement.
            if (reason === 'paste' || reason === 'change') { return false; }
            const count = Object.keys(check.errors).length;
            host.say(sheetLabel(host.sheet, 'rowInvalid', row + 1, count, Object.values(check.errors)[0]));
            return false;
        }
        this.send(row, context);
        return true;
    }

    send(row, context) {
        const item = this.rows[row];
        const host = this.#host;
        // An id from the application before the send, so that the record from outside finds this row
        if (item.kind === 'entry' && host.newRecordId()) {
            item.sentId ??= host.newRecordId()(context.record, context);
            context.record = {[host.recordKey()]: item.sentId, ...context.record};
            context.id = item.sentId;
        }
        if (!host.emit('spreadsheet-row-submit', context)) { return; }
        item.state = 'pending';
        item.error = null;
        host.rowsChanged();
        host.say(sheetLabel(host.sheet, 'rowSending', row + 1));
        const done = (value) => {
            if (item.state !== 'pending') { return; }
            item.state = 'sent';
            if (item.kind === 'entry') {
                const id = value && typeof value === 'object' ? value[host.recordKey()] : undefined;
                item.sentId = id === undefined ? (item.sentId ?? null) : id;
            }
            // The data can come before the answer, for example from a websocket. Then the row
            // takes its record now.
            const arrived = item.kind === 'record'
                || (item.sentId !== null && this.records.some((record, index) => this.#idOf(record, index) === item.sentId));
            if (arrived) { this.setRecords(this.records); }
            // The row can be gone now: a record row from outside shows the same record
            let at = this.rows.indexOf(item);
            if (at < 0 && item.sentId !== null && item.sentId !== undefined) { at = this.rows.findIndex(other => other.kind === 'record' && other.id === item.sentId); }
            host.rowsChanged();
            if (at >= 0) { host.say(sheetLabel(host.sheet, 'rowSent', at + 1)); }
            host.emit('spreadsheet-row-state', {row: at, state: 'sent', value: value ?? null});
        };
        const fail = (error) => {
            if (item.state !== 'pending') { return; }
            item.state = 'error';
            item.error = error?.message ?? String(error ?? sheetLabel(host.sheet, 'sendFailed'));
            const at = this.rows.indexOf(item);
            host.rowsChanged();
            if (at >= 0) { host.say(sheetLabel(host.sheet, 'rowFailed', at + 1, item.error)); }
            host.emit('spreadsheet-row-state', {row: at, state: 'error', error: item.error});
        };
        let result;
        try {
            result = host.onSubmitRow()?.(context.record, context);
        } catch (error) {
            fail(error);
            return;
        }
        if (result && typeof result.then === 'function') {
            result.then(done, fail);
        } else {
            done(result);
        }
    }

    // Sends each row with changes that has no problem. Returns the number of rows sent.
    submitAll() {
        let count = 0;
        for (let row = 0; row < this.rows.length; row++) {
            if (this.consider(row, 'manual')) { count++; }
        }
        return count;
    }
}
