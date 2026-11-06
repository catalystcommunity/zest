// Times for the players. The display form is short, and the spoken form is for a screen reader.

const finite = (seconds) => (Number.isFinite(seconds) && seconds > 0 ? seconds : 0);

// 65 -> '1:05', 3723 -> '1:02:03'
export function formatTime(seconds) {
    const total = Math.floor(finite(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const DEFAULT_UNITS = {hour: ['hour', 'hours'], minute: ['minute', 'minutes'], second: ['second', 'seconds']};

// 65 -> '1 minute 5 seconds'. units can change the words.
export function spokenTime(seconds, units = DEFAULT_UNITS) {
    const total = Math.floor(finite(seconds));
    const parts = [];
    const add = (count, [one, many]) => { if (count) { parts.push(`${count} ${count === 1 ? one : many}`); } };
    add(Math.floor(total / 3600), units.hour);
    add(Math.floor((total % 3600) / 60), units.minute);
    add(total % 60, units.second);
    return parts.length ? parts.join(' ') : `0 ${units.second[1]}`;
}
