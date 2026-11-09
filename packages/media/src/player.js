import { BaseComponent, tokenAliases, visuallyHidden } from "@catalystcommunity/base-components";
import { formatTime, spokenTime } from "./time.js";

// The video and audio players share these controls. The design and the keys are in the README.
// The player makes its DOM one time. A media event changes only the parts that show that state,
// so the focus and the position of a slider stay where they are.

const ICONS = {
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
    volume: '<path d="M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 9v6h4l5 4V5L8 9z"/>',
    muted: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2"/>',
    captions: '<path d="M3 5h18v14H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 10h5v1.5H6zM13 10h5v1.5h-5zM6 13.5h8V15H6zM15.5 13.5H18V15h-2.5z"/>',
    fullscreen: '<path d="M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z"/>',
    exitFullscreen: '<path d="M8 4h2v6H4V8h4zM14 4h2v4h4v2h-6zM4 14h6v6H8v-4H4zM14 14h6v2h-4v4h-2z"/>',
    pip: '<path d="M3 5h18v14H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11h7v6h-7z"/>',
    previous: '<path d="M6 5h2v14H6zM20 5v14L9 12z"/>',
    next: '<path d="M16 5h2v14h-2zM4 5v14l11-7z"/>',
};

const icon = (name) => `<svg viewBox="0 0 24 24" width="1.25em" height="1.25em" aria-hidden="true" focusable="false" fill="currentColor">${ICONS[name]}</svg>`;

const DEFAULT_LABELS = {
    controls: 'Player controls',
    play: 'Play',
    pause: 'Pause',
    seek: 'Seek',
    volume: 'Volume',
    mute: 'Mute',
    speed: 'Speed',
    captions: 'Captions',
    fullscreen: 'Full screen',
    pictureInPicture: 'Picture in picture',
    previous: 'Previous track',
    next: 'Next track',
    playlist: 'Playlist',
    of: 'of',
    muted: 'Muted',
    unmuted: 'Sound on',
    volumePercent: (percent) => `Volume ${percent} percent`,
    captionsOn: 'Captions on',
    captionsOff: 'Captions off',
    error: 'This media cannot play.',
    units: {hour: ['hour', 'hours'], minute: ['minute', 'minutes'], second: ['second', 'seconds']},
};

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const playerStyles = `
.zest-media {
    ${tokenAliases('media-player')}
    --_control-size: var(--zest-media-player-control-size, 2.5em);
    --_track-height: var(--zest-media-player-track-height, 0.375em);
    display: flex;
    flex-direction: column;
    min-width: 0;
    box-sizing: border-box;
    color: var(--_face-text);
    background: var(--_face);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    overflow: hidden;
    container-type: inline-size;
}
.zest-media .zest-sr {
    ${visuallyHidden}
}
.zest-media .zest-player-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25em;
    padding: 0.25em;
}
.zest-media button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-width: max(24px, var(--_control-size));
    min-height: max(24px, var(--_control-size));
    padding: 0 0.25em;
    margin: 0;
    font: inherit;
    color: inherit;
    background: none;
    border: var(--_border-width) solid transparent;
    border-radius: var(--_radius);
    cursor: pointer;
    transition: background-color var(--_motion), border-color var(--_motion);
}
.zest-media button:hover {
    background: var(--_hover-face);
    border-color: var(--_border);
}
.zest-media button[aria-pressed="true"] {
    background: var(--_selected-face);
    color: var(--_selected-text);
}
.zest-media button[hidden], .zest-media [hidden] {
    display: none;
}
.zest-media :focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
.zest-media input[type="range"] {
    min-width: 4em;
    min-height: 24px;
    margin: 0;
    accent-color: var(--_highlight);
    background: none;
    cursor: pointer;
}
.zest-media .zest-seek {
    flex: 1 1 8em;
}
.zest-media .zest-volume {
    flex: 0 1 6em;
    width: 6em;
}
.zest-media .zest-time {
    min-width: 0;
    padding-inline: 0.25em;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.zest-media select {
    min-height: max(24px, var(--_control-size));
    font: inherit;
    color: var(--_field-text);
    background: var(--_field);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
}
.zest-media .zest-media-message {
    padding: 0.5em;
    color: var(--_invalid);
}
@container (max-width: 26em) {
    .zest-media .zest-volume, .zest-media .zest-rate {
        display: none;
    }
}
@media (forced-colors: active) {
    .zest-media button[aria-pressed="true"] {
        background: Highlight;
        color: HighlightText;
        forced-color-adjust: none;
    }
}
`;

// The parts that both players share. A child class gives the layout and the media element.
export class MediaPlayer extends BaseComponent {
    static properties = {
        src: {type: String, default: ''},
        autoplay: {type: Boolean},
        loop: {type: Boolean},
        muted: {type: Boolean},
        label: {type: String, default: ''},
        labels: {type: Object, attribute: false, default: () => ({})},
    };
    // The start of the name of each event that this player sends, for example 'video-player-play'
    static eventPrefix = 'media-player';
    static mediaTag = 'audio';
    static RELAY = ['play', 'pause', 'ended', 'seeked', 'volumechange', 'ratechange', 'timeupdate', 'loadedmetadata', 'error'];

    #built = false;
    #media = null;
    #parts = {};
    #scrubbing = false;

    get media() { return this.#media; }
    get parts() { return this.#parts; }
    get text() { return {...DEFAULT_LABELS, ...this.labels}; }

    get paused() { return this.#media?.paused ?? true; }
    get duration() { return Number.isFinite(this.#media?.duration) ? this.#media.duration : 0; }
    get currentTime() { return this.#media?.currentTime ?? 0; }
    set currentTime(seconds) { this.seek(seconds); }
    get volume() { return this.#media?.volume ?? 1; }
    set volume(value) { if (this.#media) { this.#media.volume = Math.min(1, Math.max(0, Number(value))); } }
    get playbackRate() { return this.#media?.playbackRate ?? 1; }
    set playbackRate(value) { if (this.#media) { this.#media.playbackRate = Number(value); } }

    connectedCallback() {
        super.connectedCallback();
        if (!this.#built) { this.#build(); }
        // A fallback style element from an earlier connect must not stay twice
        this.#parts.wrapper.querySelectorAll(':scope > style').forEach(style => style.remove());
        this.applyStyles(this.#parts.wrapper);
        this.render();
    }

    #build() {
        this.#built = true;
        const media = document.createElement(this.constructor.mediaTag);
        media.setAttribute('part', 'media');
        media.preload = 'metadata';
        this.#media = media;
        // The <source> and <track> children of the application go into the media element
        for (const child of [...this.children]) {
            if (child.localName === 'source' || child.localName === 'track') { media.append(child); }
        }
        const wrapper = document.createElement('div');
        wrapper.className = `zest-media zest-${this.constructor.eventPrefix}`;
        wrapper.setAttribute('part', 'player');
        this.#parts.wrapper = wrapper;
        this.buildLayout(wrapper, media);
        this.root.append(wrapper);
        this.#wire();
    }

    // A child class puts the media element and the controls into the wrapper
    buildLayout(wrapper, media) {
        wrapper.append(media, this.buildControls());
    }

    // Makes the controls that the player shows. A child class can add or leave out a control.
    buildControls({fullscreen = false, captions = false, pictureInPicture = false, playlist = false} = {}) {
        const t = this.text;
        const controls = document.createElement('div');
        // A page often has its own .controls class, so the name is longer
        controls.className = 'zest-player-controls';
        controls.setAttribute('role', 'group');
        controls.setAttribute('part', 'controls');
        const button = (name, label, iconName, pressed) => {
            const element = document.createElement('button');
            element.type = 'button';
            element.className = `zest-${name}`;
            element.setAttribute('aria-label', label);
            element.innerHTML = icon(iconName);
            if (pressed !== undefined) { element.setAttribute('aria-pressed', String(pressed)); }
            this.#parts[name] = element;
            return element;
        };
        const items = [];
        if (playlist) { items.push(button('previous', t.previous, 'previous')); }
        items.push(button('play', t.play, 'play'));
        if (playlist) { items.push(button('next', t.next, 'next')); }
        const seek = document.createElement('input');
        seek.type = 'range';
        seek.className = 'zest-seek';
        seek.min = '0';
        seek.max = '0';
        seek.step = 'any';
        seek.value = '0';
        seek.setAttribute('aria-label', t.seek);
        this.#parts.seek = seek;
        const time = document.createElement('span');
        time.className = 'zest-time';
        time.setAttribute('part', 'time');
        time.textContent = '0:00 / 0:00';
        this.#parts.time = time;
        items.push(seek, time, button('mute', t.mute, 'volume', false));
        const volume = document.createElement('input');
        volume.type = 'range';
        volume.className = 'zest-volume';
        volume.min = '0';
        volume.max = '1';
        volume.step = '0.05';
        volume.setAttribute('aria-label', t.volume);
        this.#parts.volume = volume;
        const rate = document.createElement('select');
        rate.className = 'zest-rate';
        rate.setAttribute('aria-label', t.speed);
        for (const value of RATES) {
            rate.append(new Option(`${value}×`, String(value), value === 1, value === 1));
        }
        this.#parts.rate = rate;
        items.push(volume, rate);
        if (captions) { items.push(button('captions', t.captions, 'captions', false)); }
        if (pictureInPicture) { items.push(button('pip', t.pictureInPicture, 'pip', false)); }
        if (fullscreen) { items.push(button('fullscreen', t.fullscreen, 'fullscreen', false)); }
        const live = document.createElement('div');
        live.className = 'zest-sr';
        live.setAttribute('aria-live', 'polite');
        this.#parts.live = live;
        const message = document.createElement('div');
        message.className = 'zest-media-message';
        message.hidden = true;
        this.#parts.message = message;
        controls.append(...items);
        this.#parts.controls = controls;
        const holder = document.createDocumentFragment();
        holder.append(controls, message, live);
        return holder;
    }

    #wire() {
        const media = this.#media;
        const p = this.#parts;
        const prefix = this.constructor.eventPrefix;
        // Media events do not bubble, so the player sends its own events, which bubble and leave a shadow root
        for (const name of this.constructor.RELAY) {
            media.addEventListener(name, () => this.emit(`${prefix}-${name}`, this.state()));
        }
        for (const name of ['play', 'pause', 'ended', 'emptied']) {
            media.addEventListener(name, () => this.showPlaying());
        }
        for (const name of ['timeupdate', 'durationchange', 'loadedmetadata', 'seeked', 'emptied']) {
            media.addEventListener(name, () => this.showTime());
        }
        media.addEventListener('volumechange', () => {
            if (this.muted !== media.muted) { this.muted = media.muted; }
            this.showVolume();
        });
        media.addEventListener('ratechange', () => { p.rate.value = String(media.playbackRate); });
        media.addEventListener('error', () => {
            p.message.textContent = this.text.error;
            p.message.hidden = false;
        });
        media.addEventListener('loadstart', () => { p.message.hidden = true; });

        p.play.addEventListener('click', () => this.togglePlay());
        p.mute.addEventListener('click', () => this.toggleMute());
        p.seek.addEventListener('pointerdown', () => { this.#scrubbing = true; });
        p.seek.addEventListener('pointerup', () => { this.#scrubbing = false; });
        p.seek.addEventListener('input', () => this.seek(Number(p.seek.value)));
        p.seek.addEventListener('change', () => { this.#scrubbing = false; });
        p.volume.addEventListener('input', () => {
            media.volume = Number(p.volume.value);
            if (media.volume > 0 && media.muted) { media.muted = false; }
        });
        p.rate.addEventListener('change', () => { media.playbackRate = Number(p.rate.value); });
        p.wrapper.addEventListener('keydown', (e) => this.#onKeydown(e));
    }

    // The state that each event of the player gives in its detail
    state() {
        const media = this.#media;
        return {
            currentTime: media.currentTime,
            duration: this.duration,
            paused: media.paused,
            ended: media.ended,
            volume: media.volume,
            muted: media.muted,
            playbackRate: media.playbackRate,
            src: media.currentSrc || this.src,
        };
    }

    propertyChanged(name, oldValue, newValue) {
        // The base class can call this before the fields of this class exist, for a value set before the upgrade
        if (!(#media in this) || !this.#media) { return; }
        if (name === 'muted') { this.#media.muted = newValue; }
    }

    render() {
        const media = this.#media;
        if (!media) { return; }
        const src = this.currentSource();
        if (src && media.getAttribute('src') !== src) {
            media.src = src;
        } else if (!src && media.hasAttribute('src')) {
            media.removeAttribute('src');
            media.load();
        }
        // A browser plays by itself only with no sound, so autoplay also mutes
        if (this.autoplay && !this.muted) { this.muted = true; }
        media.autoplay = this.autoplay;
        media.loop = this.loopsMedia();
        media.muted = this.muted;
        this.#parts.controls.setAttribute('aria-label', this.label ? `${this.label}: ${this.text.controls}` : this.text.controls);
        this.showPlaying();
        this.showTime();
        this.showVolume();
    }

    // The address that the media element plays. The audio player gives the track of its playlist.
    currentSource() { return this.src; }
    loopsMedia() { return this.loop; }

    showPlaying() {
        const p = this.#parts;
        const playing = !this.#media.paused;
        p.play.setAttribute('aria-label', playing ? this.text.pause : this.text.play);
        p.play.innerHTML = icon(playing ? 'pause' : 'play');
        p.wrapper.classList.toggle('zest-playing', playing);
    }

    showTime() {
        const p = this.#parts;
        const t = this.text;
        const duration = this.duration;
        const current = this.#media.currentTime;
        p.seek.max = String(duration);
        if (!this.#scrubbing || this.getRootNode().activeElement !== p.seek) { p.seek.value = String(current); }
        p.seek.setAttribute('aria-valuetext', `${spokenTime(current, t.units)} ${t.of} ${spokenTime(duration, t.units)}`);
        p.time.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
        p.seek.style.setProperty('--_progress', duration ? `${(current / duration) * 100}%` : '0%');
    }

    showVolume() {
        const p = this.#parts;
        const media = this.#media;
        p.mute.setAttribute('aria-pressed', String(media.muted));
        p.mute.innerHTML = icon(media.muted || media.volume === 0 ? 'muted' : 'volume');
        p.volume.value = String(media.muted ? 0 : media.volume);
        p.volume.setAttribute('aria-valuetext', `${Math.round((media.muted ? 0 : media.volume) * 100)}%`);
    }

    announce(text) {
        // The same text two times must be read two times, so the region is emptied first
        const live = this.#parts.live;
        live.textContent = '';
        requestAnimationFrame(() => { live.textContent = text; });
    }

    play() {
        const result = this.#media.play();
        // A browser refuses to play with sound before the user does something. That is not an error of the page.
        result?.catch?.(() => this.showPlaying());
        return result;
    }
    pause() { this.#media.pause(); }
    togglePlay() { return this.#media.paused ? this.play() : this.pause(); }
    toggleMute() {
        this.#media.muted = !this.#media.muted;
        // Not each environment sends volumechange, so show the state now
        this.muted = this.#media.muted;
        this.showVolume();
    }

    seek(seconds) {
        const duration = this.duration;
        const target = Math.max(0, duration ? Math.min(duration, seconds) : seconds);
        this.#media.currentTime = target;
        this.showTime();
    }
    seekBy(seconds) { this.seek(this.#media.currentTime + seconds); }

    volumeBy(step) {
        const media = this.#media;
        media.muted = false;
        media.volume = Math.round(Math.min(1, Math.max(0, media.volume + step)) * 100) / 100;
    }

    // A child class adds its own keys here. Return true when the key is used.
    handleKey(e) { return false; }

    #onKeydown(e) {
        if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) { return; }
        const p = this.#parts;
        const target = e.composedPath()[0];
        // A select uses the keys itself, and a button uses Space and Enter itself
        if (target.localName === 'select') { return; }
        const onButton = target.localName === 'button';
        const onVolume = target === p.volume;
        const onSeek = target === p.seek;
        const t = this.text;
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        const seekAnnounced = (seconds) => {
            this.seekBy(seconds);
            this.announce(spokenTime(this.#media.currentTime, t.units));
        };
        switch (key) {
            case ' ':
                if (onButton) { return; }
                this.togglePlay();
                break;
            case 'k': this.togglePlay(); break;
            case 'j': seekAnnounced(-10); break;
            case 'l': seekAnnounced(10); break;
            case 'ArrowLeft':
                if (onVolume) { return; }
                seekAnnounced(-5);
                break;
            case 'ArrowRight':
                if (onVolume) { return; }
                seekAnnounced(5);
                break;
            case 'ArrowUp':
            case 'ArrowDown': {
                if (onVolume) { return; }
                const sign = key === 'ArrowUp' ? 1 : -1;
                if (onSeek) { seekAnnounced(5 * sign); break; }
                this.volumeBy(0.05 * sign);
                this.announce(t.volumePercent(Math.round(this.#media.volume * 100)));
                break;
            }
            case 'PageUp':
            case 'PageDown':
                if (onVolume) { return; }
                seekAnnounced((key === 'PageUp' ? 1 : -1) * Math.max(10, this.duration / 10));
                break;
            case 'Home':
            case 'End':
                if (onVolume) { return; }
                this.seek(key === 'Home' ? 0 : this.duration);
                this.announce(spokenTime(this.#media.currentTime, t.units));
                break;
            case 'm':
                this.toggleMute();
                this.announce(this.#media.muted ? t.muted : t.unmuted);
                break;
            default:
                if (/^[0-9]$/.test(key)) {
                    this.seek(this.duration * Number(key) / 10);
                    this.announce(spokenTime(this.#media.currentTime, t.units));
                } else if (!this.handleKey(e, key)) {
                    return;
                }
        }
        e.preventDefault();
    }
}

const videoStyles = playerStyles + `
video-player, :host {
    display: block;
    min-width: 0;
}
.zest-media.zest-video-player {
    position: relative;
}
.zest-media .zest-stage {
    position: relative;
    display: grid;
    min-height: 6em;
    background: #000;
}
.zest-media .zest-stage video {
    grid-area: 1 / 1;
    display: block;
    width: 100%;
    height: auto;
    max-height: var(--zest-video-player-max-height, 80vh);
    object-fit: contain;
}
.zest-media .zest-caption {
    grid-area: 1 / 1;
    align-self: end;
    justify-self: center;
    max-width: 90%;
    margin-block-end: 0.75em;
    padding: 0.125em 0.5em;
    color: #fff;
    background: rgb(0 0 0 / 0.8);
    border-radius: 0.25em;
    font-size: var(--zest-video-player-caption-size, 1.125em);
    text-align: center;
    white-space: pre-line;
    pointer-events: none;
}
.zest-media .zest-caption:empty {
    display: none;
}
.zest-media.zest-video-player .zest-player-controls {
    background: var(--_face);
    transition: opacity var(--_motion);
}
.zest-media.zest-video-player.zest-playing.zest-idle:not(:focus-within) .zest-player-controls {
    opacity: 0;
}
.zest-media.zest-video-player.zest-playing.zest-idle:not(:focus-within) .zest-stage {
    cursor: none;
}
.zest-media.zest-video-player:fullscreen {
    justify-content: center;
    border: none;
    border-radius: 0;
}
.zest-media.zest-video-player:fullscreen .zest-stage video {
    max-height: calc(100vh - 4em);
}
`;

// A video with its own controls, captions, full screen, and picture in picture
export class VideoPlayer extends MediaPlayer {
    static styles = videoStyles;
    static properties = {
        poster: {type: String, default: ''},
        captions: {type: Array, attribute: false, default: () => []},
        // How long the pointer must stay still before the controls hide during playback, in ms
        hideDelay: {type: Number, default: 3000, render: false},
    };
    static eventPrefix = 'video-player';
    static mediaTag = 'video';

    #caption = null;
    #captionsOn = false;
    #idleTimer = null;
    #madeTracks = [];

    get captionsOn() { return this.#captionsOn; }

    buildLayout(wrapper, media) {
        media.playsInline = true;
        media.setAttribute('playsinline', '');
        const stage = document.createElement('div');
        stage.className = 'zest-stage';
        stage.setAttribute('part', 'stage');
        const caption = document.createElement('div');
        caption.className = 'zest-caption';
        caption.setAttribute('part', 'caption');
        this.#caption = caption;
        stage.append(media, caption);
        wrapper.append(stage, this.buildControls({fullscreen: true, captions: true, pictureInPicture: true}));
        const p = this.parts;
        p.stage = stage;
        stage.addEventListener('click', () => this.togglePlay());
        stage.addEventListener('dblclick', () => this.toggleFullscreen());
        p.captions.addEventListener('click', () => this.toggleCaptions());
        p.fullscreen.addEventListener('click', () => this.toggleFullscreen());
        p.pip.addEventListener('click', () => this.togglePictureInPicture());
        media.textTracks?.addEventListener?.('addtrack', () => this.#applyCaptions());
        media.addEventListener('loadedmetadata', () => this.#applyCaptions());
        for (const name of ['pointermove', 'pointerdown', 'keydown', 'focusin']) {
            wrapper.addEventListener(name, () => this.#wake());
        }
        media.addEventListener('play', () => this.#wake());
        media.addEventListener('pause', () => wrapper.classList.remove('zest-idle'));
        media.addEventListener('enterpictureinpicture', () => p.pip.setAttribute('aria-pressed', 'true'));
        media.addEventListener('leavepictureinpicture', () => p.pip.setAttribute('aria-pressed', 'false'));
        // A <track default> turns the captions on at the start
        this.#captionsOn = [...media.querySelectorAll('track')].some(track => track.default);
    }

    connectedCallback() {
        super.connectedCallback();
        this.listen(document, 'fullscreenchange', () => this.#showFullscreen());
        this.own(() => clearTimeout(this.#idleTimer));
    }

    render() {
        super.render();
        const media = this.media;
        if (!media) { return; }
        if (this.poster) { media.poster = this.poster; } else { media.removeAttribute('poster'); }
        this.#makeTracks();
        const p = this.parts;
        p.pip.hidden = !(document.pictureInPictureEnabled && media.requestPictureInPicture);
        p.fullscreen.hidden = !(document.fullscreenEnabled ?? true);
        media.setAttribute('aria-label', this.label || 'Video');
        this.#applyCaptions();
    }

    // The captions property makes <track> elements. The <track> children of the application stay.
    #makeTracks() {
        const wanted = JSON.stringify(this.captions);
        if (this.#madeTracks.wanted === wanted) { return; }
        for (const track of this.#madeTracks) { track.remove(); }
        this.#madeTracks = this.captions.map((item) => {
            const track = document.createElement('track');
            track.kind = item.kind ?? 'captions';
            track.src = item.src;
            if (item.srclang) { track.srclang = item.srclang; }
            track.label = item.label ?? item.srclang ?? 'Captions';
            if (item.default) { track.default = true; this.#captionsOn = true; }
            return track;
        });
        this.#madeTracks.wanted = wanted;
        this.media.append(...this.#madeTracks);
    }

    #textTracks() {
        return [...(this.media?.textTracks ?? [])].filter(track => track.kind === 'captions' || track.kind === 'subtitles');
    }

    // The player shows the cues itself, so that they stay above the controls and in full screen
    #applyCaptions() {
        const tracks = this.#textTracks();
        const p = this.parts;
        p.captions.hidden = tracks.length === 0;
        p.captions.setAttribute('aria-pressed', String(this.#captionsOn));
        const chosen = this.#captionsOn ? tracks[0] : null;
        for (const track of tracks) {
            const mode = track === chosen ? 'hidden' : 'disabled';
            if (track.mode !== mode) { track.mode = mode; }
            if (track === chosen && !track.zestListening) {
                track.zestListening = true;
                track.addEventListener('cuechange', () => this.#showCue(track));
            }
        }
        if (chosen) { this.#showCue(chosen); } else { this.#caption.textContent = ''; }
    }

    #showCue(track) {
        if (!this.#captionsOn || track.mode === 'disabled') { this.#caption.textContent = ''; return; }
        const cues = [...(track.activeCues ?? [])];
        this.#caption.textContent = cues.map(cue => cue.text).join('\n');
    }

    toggleCaptions(on = !this.#captionsOn) {
        this.#captionsOn = on;
        this.#applyCaptions();
        return on;
    }

    toggleFullscreen() {
        const wrapper = this.parts.wrapper;
        if (document.fullscreenElement) {
            return document.exitFullscreen?.();
        }
        return wrapper.requestFullscreen?.()?.catch?.(() => {});
    }

    togglePictureInPicture() {
        if (document.pictureInPictureElement) { return document.exitPictureInPicture(); }
        return this.media.requestPictureInPicture?.()?.catch?.(() => {});
    }

    #showFullscreen() {
        const p = this.parts;
        const on = document.fullscreenElement === p.wrapper;
        p.fullscreen.setAttribute('aria-pressed', String(on));
        p.fullscreen.innerHTML = icon(on ? 'exitFullscreen' : 'fullscreen');
    }

    // During playback the controls hide when the pointer stays still. They never hide while the focus is in the player.
    #wake() {
        const wrapper = this.parts.wrapper;
        wrapper.classList.remove('zest-idle');
        clearTimeout(this.#idleTimer);
        if (this.media.paused) { return; }
        this.#idleTimer = setTimeout(() => {
            if (!this.media.paused) { wrapper.classList.add('zest-idle'); }
        }, this.hideDelay);
    }

    handleKey(e, key) {
        const t = this.text;
        if (key === 'f') { this.toggleFullscreen(); return true; }
        if (key === 'c' && this.#textTracks().length) {
            this.announce(this.toggleCaptions() ? t.captionsOn : t.captionsOff);
            return true;
        }
        return false;
    }
}

const audioStyles = playerStyles + `
audio-player, :host {
    display: block;
    min-width: 0;
}
.zest-media .zest-heading {
    display: flex;
    gap: var(--_gap);
    align-items: baseline;
    padding: 0.375em 0.5em 0;
    min-width: 0;
}
.zest-media .zest-track-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: bold;
}
.zest-media .zest-playlist {
    margin: 0;
    padding: 0.25em;
    list-style: none;
    border-block-start: var(--_border-width) solid var(--_line);
    background: var(--_window);
    color: var(--_window-text);
}
.zest-media .zest-playlist button {
    justify-content: flex-start;
    width: 100%;
    gap: var(--_gap);
    padding-inline: 0.5em;
    text-align: start;
    min-height: max(24px, 2em);
}
.zest-media .zest-playlist button[aria-current="true"] {
    background: var(--_selected-face);
    color: var(--_selected-text);
    font-weight: bold;
}
.zest-media .zest-playlist .zest-number {
    min-width: 1.5em;
    font-variant-numeric: tabular-nums;
}
@media (forced-colors: active) {
    .zest-media .zest-playlist button[aria-current="true"] {
        background: Highlight;
        color: HighlightText;
        forced-color-adjust: none;
    }
}
`;

// A compact audio player, with a playlist when the application gives tracks
export class AudioPlayer extends MediaPlayer {
    static styles = audioStyles;
    static properties = {
        // [{src, title}]. With tracks, src is not used.
        tracks: {type: Array, default: () => []},
        trackIndex: {type: Number, default: 0},
    };
    static eventPrefix = 'audio-player';
    static mediaTag = 'audio';

    #title = null;
    #list = null;

    get track() { return this.tracks[this.trackIndex] ?? null; }

    buildLayout(wrapper, media) {
        const heading = document.createElement('div');
        heading.className = 'zest-heading';
        const title = document.createElement('span');
        title.className = 'zest-track-title';
        title.setAttribute('part', 'title');
        this.#title = title;
        heading.append(title);
        const list = document.createElement('ol');
        list.className = 'zest-playlist';
        list.setAttribute('part', 'playlist');
        this.#list = list;
        wrapper.append(media, heading, this.buildControls({playlist: true}), list);
        const p = this.parts;
        p.previous.addEventListener('click', () => this.#choose(this.trackIndex - 1, 'previous'));
        p.next.addEventListener('click', () => this.#choose(this.trackIndex + 1, 'next'));
        list.addEventListener('click', (e) => {
            const item = e.target.closest('button[data-index]');
            if (item) { this.#choose(Number(item.dataset.index), 'select', true); }
        });
        media.addEventListener('ended', () => {
            if (this.trackIndex < this.tracks.length - 1) {
                this.#choose(this.trackIndex + 1, 'ended', true);
            } else if (this.loop && this.tracks.length > 1) {
                this.#choose(0, 'ended', true);
            }
        });
    }

    currentSource() { return this.track?.src ?? this.src; }
    // One track loops in the media element. A playlist loops in ended above.
    loopsMedia() { return this.loop && this.tracks.length <= 1; }

    render() {
        super.render();
        if (!this.#list) { return; }
        const p = this.parts;
        const many = this.tracks.length > 1;
        p.previous.hidden = !many;
        p.next.hidden = !many;
        p.previous.disabled = this.trackIndex <= 0 && !this.loop;
        p.next.disabled = this.trackIndex >= this.tracks.length - 1 && !this.loop;
        this.#title.textContent = this.track?.title ?? this.label;
        this.#title.hidden = !this.#title.textContent;
        this.#list.hidden = !many;
        this.#list.setAttribute('aria-label', this.text.playlist);
        const signature = JSON.stringify(this.tracks.map(track => track.title ?? track.src));
        if (this.#list.dataset.signature !== signature) {
            this.#list.dataset.signature = signature;
            this.#list.replaceChildren(...this.tracks.map((track, index) => {
                const item = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.index = String(index);
                button.innerHTML = `<span class="zest-number" aria-hidden="true"></span><span class="zest-name"></span>`;
                button.querySelector('.zest-number').textContent = `${index + 1}.`;
                button.querySelector('.zest-name').textContent = track.title ?? track.src;
                item.append(button);
                return item;
            }));
        }
        for (const button of this.#list.querySelectorAll('button')) {
            const current = Number(button.dataset.index) === this.trackIndex;
            if (current) { button.setAttribute('aria-current', 'true'); } else { button.removeAttribute('aria-current'); }
        }
    }

    // Goes to a track. From code, no event goes out, the same as a native input.
    selectTrack(index, {play = !this.paused} = {}) {
        const count = this.tracks.length;
        if (!count) { return; }
        const next = this.loop ? (index + count) % count : Math.max(0, Math.min(count - 1, index));
        if (next === this.trackIndex) { return; }
        this.trackIndex = next;
        // The new source must be in the media element before play() runs
        this.render();
        if (play) { this.play(); }
    }
    next() { this.selectTrack(this.trackIndex + 1); }
    previous() { this.selectTrack(this.trackIndex - 1); }

    #choose(index, reason, play = !this.paused) {
        const before = this.trackIndex;
        this.selectTrack(index, {play});
        if (this.trackIndex !== before) {
            this.emit('audio-player-track', {index: this.trackIndex, track: this.track, reason});
        } else if (reason === 'select' && play && this.paused) {
            this.play();
        }
    }
}

export class ShadowVideoPlayer extends VideoPlayer {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}

export class ShadowAudioPlayer extends AudioPlayer {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}
