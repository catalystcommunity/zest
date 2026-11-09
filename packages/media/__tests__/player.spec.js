import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { VideoPlayer, ShadowVideoPlayer, AudioPlayer, formatTime, spokenTime, defineMediaElements } from '../src';
import { fakeMedia } from './helpers.js';

beforeAll(() => {
    defineMediaElements();
    // jsdom logs "not implemented" for these, and they are not part of the tests
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {};
});

afterEach(() => {
    document.body.replaceChildren();
});

const key = (target, k, init = {}) => {
    const event = new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true, composed: true, ...init});
    target.dispatchEvent(event);
    return event;
};

function video(attributes = {}, children = '') {
    const player = document.createElement('video-player');
    for (const [name, value] of Object.entries(attributes)) { player.setAttribute(name, value); }
    player.innerHTML = children;
    document.body.append(player);
    const state = fakeMedia(player.media);
    return {player, state, q: (selector) => player.querySelector(selector)};
}

describe('times', () => {
    it('writes a short time and a spoken time', () => {
        expect(formatTime(65)).toBe('1:05');
        expect(formatTime(3723)).toBe('1:02:03');
        expect(formatTime(NaN)).toBe('0:00');
        expect(spokenTime(65)).toBe('1 minute 5 seconds');
        expect(spokenTime(3600)).toBe('1 hour');
        expect(spokenTime(0)).toBe('0 seconds');
    });
});

describe('video-player', () => {
    it('moves the source and track children of the application into the video', () => {
        const {player} = video({}, '<source src="/a.webm" type="video/webm"><track kind="captions" src="/a.vtt" default><p>Other</p>');
        expect(player.media.querySelectorAll('source, track')).toHaveLength(2);
        expect(player.querySelector(':scope > p')).not.toBeNull();
        expect(player.captionsOn).toBe(true);
    });

    it('has a labelled control for each thing that it does', () => {
        const {q} = video({src: '/a.webm', label: 'Sample'});
        expect(q('.zest-play').getAttribute('aria-label')).toBe('Play');
        expect(q('.zest-seek').getAttribute('aria-label')).toBe('Seek');
        expect(q('.zest-volume').getAttribute('aria-label')).toBe('Volume');
        expect(q('.zest-rate').getAttribute('aria-label')).toBe('Speed');
        expect(q('.zest-mute').getAttribute('aria-pressed')).toBe('false');
        expect(q('.zest-player-controls').getAttribute('aria-label')).toBe('Sample: Player controls');
        expect(q('video').getAttribute('src')).toBe('/a.webm');
    });

    it('plays with the button, and shows the pause label while it plays', () => {
        const {player, q} = video({src: '/a.webm'});
        q('.zest-play').click();
        expect(player.media.play).toHaveBeenCalled();
        expect(q('.zest-play').getAttribute('aria-label')).toBe('Pause');
        q('.zest-play').click();
        expect(player.media.pause).toHaveBeenCalled();
        expect(q('.zest-play').getAttribute('aria-label')).toBe('Play');
    });

    it('sends its own events, which bubble and leave a shadow root', () => {
        const player = document.createElement('shadow-video-player');
        const holder = document.body.appendChild(document.createElement('div'));
        holder.append(player);
        fakeMedia(player.media);
        const heard = vi.fn();
        holder.addEventListener('video-player-play', heard);
        player.play();
        expect(heard).toHaveBeenCalledTimes(1);
        expect(heard.mock.calls[0][0].detail).toMatchObject({paused: false, duration: 60});
        expect(player.shadowRoot.querySelector('.zest-play')).not.toBeNull();
        expect(player).toBeInstanceOf(ShadowVideoPlayer);
    });

    it('uses the keys of a player while the focus is in it', () => {
        const {player, state, q} = video({src: '/a.webm'});
        const seek = q('.zest-seek');
        key(seek, 'k');
        expect(player.media.play).toHaveBeenCalled();
        key(seek, 'ArrowRight');
        expect(state.currentTime).toBe(5);
        key(seek, 'l');
        expect(state.currentTime).toBe(15);
        key(seek, 'j');
        expect(state.currentTime).toBe(5);
        key(seek, '5');
        expect(state.currentTime).toBe(30);
        key(seek, 'End');
        expect(state.currentTime).toBe(60);
        key(seek, 'Home');
        expect(state.currentTime).toBe(0);
        key(q('.zest-play'), 'm');
        expect(player.media.muted).toBe(true);
        expect(q('.zest-mute').getAttribute('aria-pressed')).toBe('true');
    });

    it('tells the time as words on the seek slider', () => {
        const {player, q} = video({src: '/a.webm'});
        player.seek(65);
        // A seek past the end stops at the end
        expect(q('.zest-seek').getAttribute('aria-valuetext')).toBe('1 minute of 1 minute');
        expect(q('.zest-time').textContent).toBe('1:00 / 1:00');
        player.seek(5);
        expect(q('.zest-seek').getAttribute('aria-valuetext')).toBe('5 seconds of 1 minute');
    });

    it('leaves Space to a button, and leaves the keys of a select and the volume slider', () => {
        const {player, q} = video({src: '/a.webm'});
        expect(key(q('.zest-play'), ' ').defaultPrevented).toBe(false);
        expect(key(q('.zest-rate'), 'k').defaultPrevented).toBe(false);
        expect(key(q('.zest-volume'), 'ArrowUp').defaultPrevented).toBe(false);
        expect(key(q('.zest-seek'), 'k', {ctrlKey: true}).defaultPrevented).toBe(false);
        expect(player.media.play).not.toHaveBeenCalled();
    });

    it('changes the volume with the up and down arrows, and tells the new volume', async () => {
        const {player, q} = video({src: '/a.webm'});
        player.media.volume = 0.5;
        key(q('.zest-play'), 'ArrowDown');
        expect(player.media.volume).toBe(0.45);
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(q('.zest-sr[aria-live]').textContent).toBe('Volume 45 percent');
    });

    it('hides the captions button when there are no captions, and shows the cue text when they are on', () => {
        const {player, q} = video({src: '/a.webm'});
        expect(q('.zest-captions').hidden).toBe(true);
        expect(player.toggleCaptions(true)).toBe(true);
        expect(q('.zest-captions').getAttribute('aria-pressed')).toBe('true');
    });

    it('mutes for autoplay, because a browser plays by itself only with no sound', () => {
        const {player} = video({src: '/a.webm', autoplay: ''});
        expect(player.muted).toBe(true);
        expect(player.media.muted).toBe(true);
        expect(player.media.autoplay).toBe(true);
    });

    it('keeps a property that was set before the tag was defined', () => {
        const element = document.createElement('late-video-player');
        element.src = '/late.webm';
        element.muted = true;
        customElements.define('late-video-player', class extends VideoPlayer {});
        document.body.append(element);
        expect(element.media.getAttribute('src')).toBe('/late.webm');
        expect(element.media.muted).toBe(true);
    });

    it('hides the controls while it plays and the pointer is still, but not when the focus is in it', () => {
        vi.useFakeTimers();
        const {player, q} = video({src: '/a.webm'});
        player.hideDelay = 100;
        player.play();
        vi.advanceTimersByTime(150);
        expect(q('.zest-media').classList.contains('zest-idle')).toBe(true);
        q('.zest-media').dispatchEvent(new Event('pointermove'));
        expect(q('.zest-media').classList.contains('zest-idle')).toBe(false);
        vi.useRealTimers();
    });
});

describe('audio-player', () => {
    const tracks = [{src: '/one.ogg', title: 'One'}, {src: '/two.ogg', title: 'Two'}, {src: '/three.ogg', title: 'Three'}];

    function audio() {
        const player = document.createElement('audio-player');
        document.body.append(player);
        fakeMedia(player.media);
        player.tracks = tracks;
        player.render();
        return {player, q: (selector) => player.querySelector(selector), all: (selector) => [...player.querySelectorAll(selector)]};
    }

    it('shows a playlist, and marks the current track', () => {
        const {player, q, all} = audio();
        expect(all('.zest-playlist button').map(b => b.textContent)).toEqual(['1.One', '2.Two', '3.Three']);
        expect(q('.zest-playlist [aria-current="true"]').textContent).toBe('1.One');
        expect(q('.zest-track-title').textContent).toBe('One');
        expect(player.media.getAttribute('src')).toBe('/one.ogg');
        expect(q('.zest-previous').disabled).toBe(true);
    });

    it('goes to the next track with the button, and sends an event', () => {
        const {player, q} = audio();
        const heard = vi.fn();
        document.addEventListener('audio-player-track', heard);
        q('.zest-next').click();
        expect(player.trackIndex).toBe(1);
        expect(player.media.getAttribute('src')).toBe('/two.ogg');
        expect(heard.mock.calls[0][0].detail).toMatchObject({index: 1, reason: 'next', track: tracks[1]});
        document.removeEventListener('audio-player-track', heard);
    });

    it('sends no event for a change from code', () => {
        const {player} = audio();
        const heard = vi.fn();
        document.addEventListener('audio-player-track', heard);
        player.selectTrack(2);
        expect(player.trackIndex).toBe(2);
        expect(heard).not.toHaveBeenCalled();
        document.removeEventListener('audio-player-track', heard);
    });

    it('plays the next track when a track ends, and loops the list only with loop', () => {
        const {player} = audio();
        player.selectTrack(2);
        player.media.end();
        expect(player.trackIndex).toBe(2);
        player.loop = true;
        player.media.end();
        expect(player.trackIndex).toBe(0);
        expect(player.media.play).toHaveBeenCalled();
    });

    it('plays a track that the user selects in the list', () => {
        const {player, all} = audio();
        all('.zest-playlist button')[1].click();
        expect(player.trackIndex).toBe(1);
        expect(player.media.play).toHaveBeenCalled();
    });

    it('has no full screen and no captions keys', () => {
        const {player, q} = audio();
        expect(q('.zest-fullscreen')).toBeNull();
        expect(key(q('.zest-seek'), 'f').defaultPrevented).toBe(false);
        expect(player).toBeInstanceOf(AudioPlayer);
    });
});
