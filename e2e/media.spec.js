import { test, expect } from './fixtures.js';

const open = async (page) => {
    await page.goto('/gallery/media');
    await expect(page.getByTestId('section-media')).toBeVisible();
};
const prop = (locator, name) => locator.evaluate((element, key) => element[key], name);
const mediaProp = (locator, name) => locator.evaluate((element, key) => element.media[key], name);

test.describe('video-player', () => {
    test('plays with the button, and the time and the events follow', async ({page}) => {
        await open(page);
        const player = page.getByTestId('media-video-player');
        const play = player.locator('.play');
        await expect(play).toHaveAttribute('aria-label', 'Play');
        await expect(player.locator('.time')).toHaveText('0:00 / 0:12');
        await play.click();
        await expect(play).toHaveAttribute('aria-label', 'Pause');
        await expect.poll(() => mediaProp(player, 'currentTime')).toBeGreaterThan(1);
        await expect(player.locator('.time')).not.toHaveText(/^0:00 /);
        await expect(page.getByTestId('media-video-log')).toContainText('play at');
        await play.click();
        await expect(play).toHaveAttribute('aria-label', 'Play');
        await expect(page.getByTestId('media-video-log')).toContainText('pause at');
    });

    test('seeks, mutes, and shows captions with the keyboard', async ({page}) => {
        await open(page);
        const player = page.getByTestId('media-video-player');
        const seek = player.locator('.seek');
        await expect.poll(() => prop(player, 'duration')).toBeGreaterThan(11);
        await seek.focus();
        await page.keyboard.press('5');
        await expect.poll(() => mediaProp(player, 'currentTime')).toBeCloseTo(6, 0);
        await expect(seek).toHaveAttribute('aria-valuetext', '6 seconds of 12 seconds');
        await page.keyboard.press('ArrowLeft');
        await expect.poll(() => mediaProp(player, 'currentTime')).toBeCloseTo(1, 0);
        await expect(player.locator('.time')).toHaveText('0:01 / 0:12');
        await page.keyboard.press('m');
        await expect(player.locator('.mute')).toHaveAttribute('aria-pressed', 'true');
        expect(await mediaProp(player, 'muted')).toBe(true);
        await expect(player.locator('.captions')).toBeVisible();
        await page.keyboard.press('c');
        await expect(player.locator('.captions')).toHaveAttribute('aria-pressed', 'true');
        await expect(player.locator('.caption')).toHaveText('A test pattern with a 440 hertz tone');
        await page.keyboard.press('l');
        await expect(player.locator('.caption')).toHaveText('This is the end of the sample');
        await page.keyboard.press('c');
        await expect(player.locator('.caption')).toBeEmpty();
        // The focus stayed on the slider the whole time
        await expect(seek).toBeFocused();
    });

    test('keeps the controls while the focus is in the player', async ({page}) => {
        await open(page);
        const player = page.getByTestId('media-video-player');
        await player.evaluate(element => { element.hideDelay = 50; });
        await player.locator('.play').click();
        await page.waitForTimeout(300);
        const controls = player.locator('.player-controls');
        expect(await controls.evaluate(element => getComputedStyle(element).opacity)).toBe('1');
        await page.locator('h1, h2').first().click();
        await player.evaluate(element => element.play());
        await page.waitForTimeout(300);
        await expect.poll(() => controls.evaluate(element => getComputedStyle(element).opacity)).toBe('0');
        await player.evaluate(element => element.pause());
    });
});

test.describe('audio-player', () => {
    test('goes to the next track in the playlist, and plays it', async ({page}) => {
        await open(page);
        const player = page.getByTestId('media-audio-player');
        await player.locator('.play').click();
        await expect.poll(() => mediaProp(player, 'currentTime')).toBeGreaterThan(0.2);
        await player.locator('.next').click();
        await expect(player.locator('.playlist [aria-current="true"]')).toContainText('High tone');
        await expect(player.locator('.track-title')).toHaveText('High tone, 660 hertz');
        await expect.poll(() => mediaProp(player, 'currentSrc')).toContain('tone-high.ogg');
        await expect.poll(() => mediaProp(player, 'paused')).toBe(false);
        await expect(page.getByTestId('media-audio-log')).toContainText('track 2 (next)');
        await player.locator('.playlist button').first().click();
        await expect(page.getByTestId('media-audio-log')).toContainText('track 1 (select)');
        await player.evaluate(element => element.pause());
    });
});

test.describe('canvas-view', () => {
    test('draws at most one time in a frame for many requests', async ({page}) => {
        await open(page);
        const view = page.getByTestId('media-drawing-view');
        await view.scrollIntoViewIfNeeded();
        const result = await view.evaluate(async (element) => {
            const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
            await frame();
            element.resetStats();
            for (let i = 0; i < 1000; i++) { element.invalidate(); }
            await frame();
            await frame();
            return element.stats;
        });
        expect(result.invalidations).toBeGreaterThanOrEqual(1000);
        expect(result.framesDrawn).toBe(1);
    });

    test('animates only while it is on the screen', async ({page}) => {
        await open(page);
        const view = page.getByTestId('media-animation-view');
        await view.scrollIntoViewIfNeeded();
        await expect.poll(() => prop(view, 'running')).toBe(true);
        // A count after a fixed wait depends on the frame rate, and a busy CI worker draws slowly
        const first = await prop(view, 'framesDrawn');
        await expect.poll(() => prop(view, 'framesDrawn')).toBeGreaterThan(first + 5);
        await page.getByRole('heading', {name: /Media/}).first().scrollIntoViewIfNeeded();
        await page.locator('#page').evaluate(element => { element.scrollTop = 0; });
        await page.evaluate(() => { window.scrollTo(0, 0); });
        await view.evaluate(element => { element.style.marginTop = '300vh'; });
        await expect.poll(() => prop(view, 'running')).toBe(false);
        const stopped = await prop(view, 'framesDrawn');
        await page.waitForTimeout(300);
        expect(await prop(view, 'framesDrawn')).toBeLessThanOrEqual(stopped + 1);
        await view.evaluate(element => { element.style.marginTop = ''; });
        await view.scrollIntoViewIfNeeded();
        await expect.poll(() => prop(view, 'framesDrawn')).toBeGreaterThan(stopped + 5);
    });

    test('does not move with reduced motion', async ({page}) => {
        await page.emulateMedia({reducedMotion: 'reduce'});
        await open(page);
        const view = page.getByTestId('media-animation-view');
        await view.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        expect(await prop(view, 'running')).toBe(false);
        await expect(page.getByTestId('media-animation-frames')).toContainText('(stopped)');
    });

    test('draws a line where the pointer goes', async ({page}) => {
        await open(page);
        const view = page.getByTestId('media-drawing-view');
        await view.scrollIntoViewIfNeeded();
        const box = await view.boundingBox();
        await page.mouse.move(box.x + 40, box.y + 40);
        await page.mouse.down();
        await page.mouse.move(box.x + 140, box.y + 90, {steps: 10});
        await page.mouse.up();
        await expect(page.getByTestId('media-drawing-status')).toHaveText('1 line.');
        // The pixel under the middle of the line has paint, and a pixel away from it has none
        const alpha = (x, y) => view.evaluate((element, [px, py]) => {
            const ratio = element.canvas.width / element.canvas.getBoundingClientRect().width;
            return element.context.getImageData(Math.round(px * ratio), Math.round(py * ratio), 1, 1).data[3];
        }, [x, y]);
        await expect.poll(() => alpha(90, 65)).toBeGreaterThan(0);
        expect(await alpha(40, 100)).toBe(0);
        await page.getByTestId('media-drawing-clear').click();
        await expect.poll(() => alpha(90, 65)).toBe(0);
    });

    test('draws each new frame of a video with an effect', async ({page}) => {
        await open(page);
        const player = page.getByTestId('media-effect-player');
        const view = page.getByTestId('media-effect-view');
        await view.scrollIntoViewIfNeeded();
        const before = await prop(view, 'framesDrawn');
        await player.evaluate(element => { element.muted = true; return element.play(); });
        await expect.poll(() => prop(view, 'framesDrawn')).toBeGreaterThan(before + 10);
        const pixel = await view.evaluate((element) => {
            const {width, height} = element.canvas;
            return [...element.context.getImageData(Math.floor(width / 2), Math.floor(height / 2), 1, 1).data];
        });
        expect(pixel[0]).toBe(pixel[1]);
        expect(pixel[1]).toBe(pixel[2]);
        expect(pixel[3]).toBe(255);
        await player.evaluate(element => element.pause());
    });
});

test.describe('image-view', () => {
    test('zooms with the keys and moves with the arrows', async ({page}) => {
        await open(page);
        const view = page.getByTestId('media-image-view');
        const viewport = view.locator('.viewport');
        await expect.poll(() => view.evaluate(element => element.image.naturalWidth)).toBe(640);
        const level = view.locator('.level');
        const start = await level.textContent();
        await viewport.focus();
        await page.keyboard.press('+');
        await page.keyboard.press('+');
        await expect(level).not.toHaveText(start);
        expect(parseInt(await level.textContent(), 10)).toBeGreaterThan(parseInt(start, 10));
        const before = await prop(view, 'offset');
        await page.keyboard.press('ArrowRight');
        expect((await prop(view, 'offset')).x).toBeLessThan(before.x);
        await page.keyboard.press('0');
        await expect(level).toHaveText(start);
        await expect(view.locator('.fit-contain')).toHaveAttribute('aria-pressed', 'true');
    });

    test('zooms at the pointer with Ctrl and the wheel', async ({page}) => {
        await open(page);
        const view = page.getByTestId('media-image-view');
        await view.scrollIntoViewIfNeeded();
        await expect.poll(() => view.evaluate(element => element.image.naturalWidth)).toBe(640);
        // A real Ctrl and wheel zooms the browser in some environments, so the test sends the event itself
        const result = await view.locator('.viewport').evaluate((viewport) => {
            const rect = viewport.getBoundingClientRect();
            const event = new WheelEvent('wheel', {deltaY: -300, ctrlKey: true, clientX: rect.left + 10, clientY: rect.top + 10, bubbles: true, cancelable: true});
            viewport.dispatchEvent(event);
            return event.defaultPrevented;
        });
        expect(result).toBe(true);
        expect(await prop(view, 'zoom')).toBeGreaterThan(1.5);
        // A wheel with no Ctrl scrolls the page, and does not zoom
        const plain = await view.locator('.viewport').evaluate((viewport) => {
            const event = new WheelEvent('wheel', {deltaY: -300, bubbles: true, cancelable: true});
            viewport.dispatchEvent(event);
            return event.defaultPrevented;
        });
        expect(plain).toBe(false);
    });
});
