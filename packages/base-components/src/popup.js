// Puts a popup next to its anchor, in the window. Use it with popover="manual", so that a parent
// with overflow: hidden cannot clip the popup, and give the popup position: fixed.

const OPPOSITE = {top: 'bottom', bottom: 'top', left: 'right', right: 'left'};

// placement: 'bottom-start', 'bottom-end', 'top-start', 'right-start', 'left-start', and so on.
// 'start' and 'end' follow the direction of the text. With no room on that side, the popup goes
// to the other side. It always stays in the window.
export function placePopup(popup, anchor, {placement = 'bottom-start', offset = 2, margin = 4} = {}) {
    const rect = anchor.getBoundingClientRect();
    const view = {width: document.documentElement.clientWidth || innerWidth, height: document.documentElement.clientHeight || innerHeight};
    popup.style.position = 'fixed';
    popup.style.margin = '0';
    // The limits of the CSS of the popup stay, and the window limits are added to them
    popup.style.maxWidth = '';
    popup.style.maxHeight = '';
    const css = getComputedStyle(popup);
    const cssLimit = (value) => (value && value !== 'none' && !Number.isNaN(parseFloat(value)) ? parseFloat(value) : Infinity);
    const limits = {width: cssLimit(css.maxWidth), height: cssLimit(css.maxHeight)};
    popup.style.maxWidth = `${Math.min(limits.width, view.width - margin * 2)}px`;
    popup.style.maxHeight = `${Math.min(limits.height, view.height - margin * 2)}px`;
    const first = popup.getBoundingClientRect();
    const size = {width: first.width, height: first.height};
    const rtl = getComputedStyle(anchor).direction === 'rtl';
    let [side, align = 'start'] = placement.split('-');
    if (rtl && (side === 'left' || side === 'right')) { side = OPPOSITE[side]; }
    const room = {
        bottom: view.height - rect.bottom - offset,
        top: rect.top - offset,
        right: view.width - rect.right - offset,
        left: rect.left - offset,
    };
    const vertical = side === 'top' || side === 'bottom';
    const needed = vertical ? size.height : size.width;
    if (room[side] < needed && room[OPPOSITE[side]] > room[side]) { side = OPPOSITE[side]; }
    // A popup that is larger than the room on its side gets smaller, so that it does not cover its anchor
    if (needed > room[side] - margin) {
        const space = Math.max(0, Math.floor(room[side] - margin));
        if (vertical) {
            popup.style.maxHeight = `${Math.min(limits.height, space)}px`;
        } else {
            popup.style.maxWidth = `${Math.min(limits.width, space)}px`;
        }
        const again = popup.getBoundingClientRect();
        size.width = again.width;
        size.height = again.height;
    }

    let x;
    let y;
    if (side === 'top' || side === 'bottom') {
        y = side === 'bottom' ? rect.bottom + offset : rect.top - offset - size.height;
        const startX = rtl ? rect.right - size.width : rect.left;
        const endX = rtl ? rect.left : rect.right - size.width;
        x = align === 'end' ? endX : startX;
    } else {
        x = side === 'right' ? rect.right + offset : rect.left - offset - size.width;
        y = align === 'end' ? rect.bottom - size.height : rect.top;
    }
    x = Math.max(margin, Math.min(x, view.width - size.width - margin));
    y = Math.max(margin, Math.min(y, view.height - size.height - margin));
    popup.style.left = `${Math.round(x)}px`;
    popup.style.top = `${Math.round(y)}px`;
    popup.dataset.side = side;
    return side;
}

// Puts a popup at a point, for example a context menu at the pointer
export function placePopupAt(popup, x, y, {margin = 4} = {}) {
    const anchor = {getBoundingClientRect: () => ({left: x, right: x, top: y, bottom: y, width: 0, height: 0})};
    popup.style.position = 'fixed';
    popup.style.margin = '0';
    const size = popup.getBoundingClientRect();
    const view = {width: document.documentElement.clientWidth || innerWidth, height: document.documentElement.clientHeight || innerHeight};
    const left = x + size.width + margin > view.width ? x - size.width : x;
    const top = y + size.height + margin > view.height ? y - size.height : y;
    popup.style.left = `${Math.round(Math.max(margin, left))}px`;
    popup.style.top = `${Math.round(Math.max(margin, top))}px`;
    return anchor;
}
