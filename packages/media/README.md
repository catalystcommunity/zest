# `Media`

Players for video and audio, a canvas view that draws one time in each frame, and an image view with zoom.

## Usage

```js
import { defineMediaElements } from '@catalystcommunity/media';

// Defines video-player, audio-player, canvas-view, image-view, and a shadow-... tag for each one
defineMediaElements();
```

Or define only the tags that you use:

```js
import { VideoPlayer } from '@catalystcommunity/media';

customElements.define('video-player', VideoPlayer);
```

Each component makes all of its own parts, so it uses the light DOM. Each one also has a `Shadow...` class with an open shadow root: `ShadowVideoPlayer`, `ShadowAudioPlayer`, `ShadowCanvasView`, and `ShadowImageView`.

Use WebM (VP8 or VP9, with Opus or Vorbis) for video, and Ogg Opus for audio. All browsers play these. Some builds of Chromium do not play H.264 or AAC.

## `VideoPlayer`

```html
<video-player src="/media/talk.webm" poster="/media/talk.png" label="The talk">
  <track kind="captions" src="/media/talk.vtt" srclang="en" label="English" default>
</video-player>
```

| Attribute | Default | Description |
| --- | --- | --- |
| `src` | | The address of the video. You can also put `<source>` elements in the player. |
| `poster` | | The picture before the video plays. |
| `label` | | The name of the video. The group of controls and the video use it. |
| `autoplay` | | Plays when the video loads. A browser plays a video by itself only with no sound, so this also sets `muted`. |
| `loop` | | Plays again from the start at the end. |
| `muted` | | No sound. |
| `hide-delay` | 3000 | During playback, the controls hide after the pointer stays still for this time, in milliseconds. |

- The player moves its `<source>` and `<track>` children into the video. The `captions` property makes tracks too: `player.captions = [{src, srclang, label, default}]`.
- The player shows the captions itself, above the controls. They stay in full screen.
- The controls never hide while the focus is in the player.
- Properties: `media` (the `<video>`), `paused`, `duration`, `currentTime`, `volume`, `playbackRate`, `captionsOn`, and `labels`.
- Methods: `play()`, `pause()`, `togglePlay()`, `seek(seconds)`, `seekBy(seconds)`, `toggleMute()`, `toggleCaptions(on)`, `toggleFullscreen()`, and `togglePictureInPicture()`.
- The picture in picture button shows only in a browser that supports it.

## `AudioPlayer`

```js
const player = document.querySelector('audio-player');
player.tracks = [
  {src: '/music/one.ogg', title: 'One'},
  {src: '/music/two.ogg', title: 'Two'},
];
player.addEventListener('audio-player-track', (e) => console.log(e.detail.index, e.detail.reason));
```

- It has the same attributes as the video player, except `poster` and `hide-delay`.
- With two or more tracks, it shows a playlist and the previous and next buttons. When a track ends, the next track plays. With `loop`, the list starts again after the last track.
- `audio-player-track` goes out when the track changes because of the user or because a track ended. `detail` is `{index, track, reason}`. The reason is `next`, `previous`, `select`, or `ended`.
- `selectTrack(index)`, `next()`, and `previous()` change the track from code. They send no event.
- `track-index` is the index of the current track.

## Keys of the Players

The keys work while the focus is in the player.

| Key | Action |
| --- | --- |
| Space, K | Play or pause. On a button, Space pushes the button. |
| J, L | Go back or forward 10 seconds. |
| Left arrow, right arrow | Go back or forward 5 seconds. |
| Up arrow, down arrow | Make the volume higher or lower. On the seek slider, go forward or back 5 seconds. |
| Page Up, Page Down | Go forward or back by one tenth of the media. |
| Home, End | Go to the start or the end. |
| 0 to 9 | Go to 0% to 90% of the media. |
| M | Mute, or turn the sound on. |
| C | Turn the captions on or off. Video only. |
| F | Full screen. Video only. |

On the volume slider, the arrow keys change the volume. A select uses all of its keys. A live region tells the result of each key, for example "Volume 45 percent".

## Events of the Players

A media element sends events that do not bubble. The player sends its own events, which bubble and leave a shadow root. Each `detail` is `{currentTime, duration, paused, ended, volume, muted, playbackRate, src}`.

The names are `video-player-<name>` and `audio-player-<name>`, where the name is `play`, `pause`, `ended`, `seeked`, `volumechange`, `ratechange`, `timeupdate`, `loadedmetadata`, or `error`.

## `CanvasView`

The paint surface of the toolkit. The application gives a `draw` function. The view calls it at most one time in each frame, however many times something asks for a draw.

```js
const view = document.querySelector('canvas-view');
view.draw = (context, {width, height, time, delta, frame}) => {
  context.fillRect(10, 10, width / 2, height / 2);
};
view.addEventListener('pointermove', (e) => {
  const point = view.toCanvasPoint(e);
  // ... change the model
  view.invalidate();
});
```

| Attribute | Default | Description |
| --- | --- | --- |
| `label` | | The name of the picture. With a label, or with no fallback content, the canvas has the role `img`. |
| `description` | | Longer text about the picture, for a screen reader. |
| `context` | `2d` | `2d`, `webgl`, or `webgl2`. Set it before the first draw. |
| `animate` | | Draws again in each frame. The animation stops while the canvas is off the screen or the page is hidden. The property is `animated`, because `animate()` is a method of each element. |
| `essential-motion` | | The animation continues with reduced motion. Use it only when the motion is necessary to understand the content. |
| `focusable` | | Puts the canvas in the tab order, for an application that uses keys on it. |
| `auto-clear` | true | Clears a 2D canvas before each draw. Set `auto-clear="false"` to draw on top of the last frame. |
| `pixel-ratio` | the screen | A number in place of the pixel ratio of the screen. |
| `fit` | `contain` | How a `source` fits when there is no `draw`: `contain`, `cover`, or `fill`. |

- The canvas has the size of the element in device pixels, so lines stay sharp. In a 2D context, `draw` uses CSS pixels. In WebGL, the view sets the viewport to the full canvas.
- `draw(context, info)` gets `info = {width, height, pixelRatio, time, delta, frame, source, view}`.
- `invalidate()` asks for a draw. The view draws in the next frame.
- `toCanvasPoint(event)` gives `{x, y, pixelX, pixelY, inside}`. `x` and `y` are CSS pixels from the top left of the canvas.
- `contextOptions` gives options to `getContext`, for example `{willReadFrequently: true}` for an effect that reads pixels.
- The children of the application are the fallback content of the canvas. A screen reader can read them.
- `framesDrawn`, `lastDrawMs`, `stats`, and `resetStats()` tell how many frames the view drew and how long each draw took.
- Set the height with `--zest-canvas-view-height` (default `15em`). For a drawing area, set `--zest-canvas-view-touch-action: none`, so that a touch draws and does not scroll.

### Video on a Canvas

Set `source` to a `<video>` element or to a video player. The view draws again for each new frame of the video. It uses `requestVideoFrameCallback` when the browser has it. With no `draw`, the view draws the video. With `draw`, your function draws, and `info.source` is the video:

```js
import { drawVideoFrame } from '@catalystcommunity/media';

view.source = document.querySelector('video-player');
view.draw = (context, {width, height, source}) => {
  const rect = drawVideoFrame(context, source, {width, height, fit: 'contain'});
  if (rect) { context.strokeRect(rect.x, rect.y, rect.width, rect.height); }
};
```

`drawVideoFrame` gives the rectangle that it used, or `null` when the video has no frame yet. `fitRect(sourceWidth, sourceHeight, width, height, fit)` gives the rectangle with no draw.

## `ImageView`

```html
<image-view src="/photos/map.png" alt="A map of the city center"></image-view>
```

| Attribute | Default | Description |
| --- | --- | --- |
| `src` | | The address of the image. |
| `alt` | | Necessary. The text of the image. Use `alt=""` only for a picture with no meaning. With no `alt`, the view writes a warning. |
| `fit` | `contain` | `contain` shows all of the image. `cover` fills the view. `actual` shows one image pixel for each CSS pixel. |
| `zoom` | 1 | The zoom of the fit size. |
| `min-zoom`, `max-zoom` | 0.25, 8 | The limits of the zoom. |
| `zoom-step` | 1.25 | The factor of one step of zoom. |

| Key or pointer | Action |
| --- | --- |
| Plus, minus | Zoom in or out. |
| 0 | Go back to the fit size. |
| Arrow keys | Move the image. |
| Drag | Move the image. |
| Ctrl and the wheel | Zoom at the pointer. The wheel alone scrolls the page. |

- The buttons do the same as the keys, so a user does not need a drag or a wheel.
- The image always covers the view, or stays in the center when it is smaller than the view.
- `image-view-zoom` goes out when the user changes the zoom or the fit. `detail` is `{zoom, scale, fit}`.
- `zoomTo(zoom, x, y)` zooms and keeps the point `(x, y)` in place. `panBy(dx, dy)` moves the image. `reset()` goes back to the fit size.
- Set the height with `--zest-image-view-height` (default `20em`).

## Look

The components read the tokens in this order: the widget token, then `--zest-control-*`, then the global tokens, then the system colors. The widget names are `media-player`, `canvas-view`, and `image-view`, for example `--zest-media-player-face`.

| Token | Use |
| --- | --- |
| `--zest-media-player-control-size` | The size of a control of a player, `2.5em`. |
| `--zest-video-player-max-height` | The largest height of the video, `80vh`. |
| `--zest-video-player-caption-size` | The size of the caption text, `1.125em`. |
| `--zest-canvas-view-height` | The height of the canvas, `15em`. |
| `--zest-canvas-view-window` | The color behind the canvas. |
| `--zest-image-view-height` | The height of the image view, `20em`. |
| `--zest-image-view-control-height` | The height of the buttons of the image view. |

The parts are `player`, `media`, `stage`, `caption`, `controls`, `time`, `title`, `playlist`, `view`, `canvas`, `tools`, `level`, `viewport`, and `image`.

Each class that a component puts on its own elements starts with `zest-`, so that a page rule for a class such as `.play` or `.time` does not change the component. Use the parts to style the components.

In a narrow player, the volume slider and the speed select are hidden. The player decides from its own width. The volume keys and the menu of the browser still work.
