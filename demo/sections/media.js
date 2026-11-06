// The gallery section of @catalystcommunity/media. definitions are the tags that the demo defines.
import {card, el, button, makeLog} from '../kit.js';
import {
  VideoPlayer, ShadowVideoPlayer, AudioPlayer, ShadowAudioPlayer, CanvasView, ShadowCanvasView, ImageView, ShadowImageView,
  drawVideoFrame,
} from '../../src/index.js';

export const definitions = {
  'video-player': VideoPlayer,
  'shadow-video-player': ShadowVideoPlayer,
  'audio-player': AudioPlayer,
  'shadow-audio-player': ShadowAudioPlayer,
  'canvas-view': CanvasView,
  'shadow-canvas-view': ShadowCanvasView,
  'image-view': ImageView,
  'shadow-image-view': ShadowImageView,
};

const wide = (element) => { element.classList.add('wide'); return element; };

function videoCard() {
  const log = makeLog('media-video-log');
  const player = el('video-player', {src: '/media/sample.webm', label: 'Test pattern', 'data-testid': 'media-video-player'});
  player.captions = [{src: '/media/sample.vtt', srclang: 'en', label: 'English'}];
  for (const name of ['play', 'pause', 'ended', 'seeked']) {
    player.addEventListener(`video-player-${name}`, (e) => log.add(`${name} at ${e.detail.currentTime.toFixed(1)}`));
  }
  return wide(card('media-video', 'Video player with captions', player,
    el('p', {}, 'With the focus in the player: Space or K plays, J and L go 10 seconds, the arrows go 5 seconds, M mutes, C shows captions, F is full screen.'),
    log));
}

function audioCard() {
  const log = makeLog('media-audio-log');
  const player = el('audio-player', {label: 'Tones', 'data-testid': 'media-audio-player'});
  player.tracks = [
    {src: '/media/tone-low.ogg', title: 'Low tone, 330 hertz'},
    {src: '/media/tone-high.ogg', title: 'High tone, 660 hertz'},
  ];
  player.addEventListener('audio-player-track', (e) => log.add(`track ${e.detail.index + 1} (${e.detail.reason})`));
  return card('media-audio', 'Audio player with a playlist', player, log);
}

function animationCard() {
  const view = el('canvas-view', {label: 'Three balls that move', animate: '', 'data-testid': 'media-animation-view'});
  const balls = [0, 1, 2].map(i => ({x: 30 + i * 40, y: 30 + i * 20, dx: 1.4 + i * 0.6, dy: 1 + i * 0.4, r: 10 + i * 4}));
  const colors = ['#0a5ab8', '#1e7a3a', '#b3261e'];
  view.draw = (context, {width, height, delta}) => {
    const step = Math.min(delta, 50) / 16;
    const text = getComputedStyle(view).color;
    for (const [i, ball] of balls.entries()) {
      ball.x += ball.dx * step;
      ball.y += ball.dy * step;
      if (ball.x < ball.r || ball.x > width - ball.r) { ball.dx *= -1; ball.x = Math.max(ball.r, Math.min(width - ball.r, ball.x)); }
      if (ball.y < ball.r || ball.y > height - ball.r) { ball.dy *= -1; ball.y = Math.max(ball.r, Math.min(height - ball.r, ball.y)); }
      context.beginPath();
      context.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      context.fillStyle = colors[i];
      context.fill();
    }
    context.fillStyle = text;
    context.font = '12px system-ui, sans-serif';
    context.fillText(`Frame ${view.framesDrawn}`, 8, height - 8);
  };
  const output = el('output', {'data-testid': 'media-animation-frames'}, 'Frames: 0');
  const timer = setInterval(() => {
    if (!view.isConnected) { clearInterval(timer); return; }
    output.textContent = `Frames: ${view.framesDrawn}${view.running ? '' : ' (stopped)'}`;
  }, 250);
  const toggle = button('media-animation-toggle', 'Stop', () => {
    view.animate = !view.animate;
    toggle.textContent = view.animate ? 'Stop' : 'Start';
  });
  return card('media-animation', 'Canvas view: an animation',
    el('p', {}, 'It draws one time in each frame, and stops when it is off the screen. With reduced motion, it does not move.'),
    view, el('div', {class: 'controls'}, toggle, output));
}

function drawingCard() {
  const view = el('canvas-view', {label: 'A drawing area', 'data-testid': 'media-drawing-view'});
  view.style.setProperty('--zest-canvas-view-touch-action', 'none');
  const lines = [];
  let line = null;
  view.draw = (context) => {
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = getComputedStyle(view).color;
    for (const points of lines) {
      context.beginPath();
      points.forEach((point, i) => (i ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
      if (points.length === 1) { context.lineTo(points[0].x + 0.1, points[0].y); }
      context.stroke();
    }
  };
  const status = el('output', {'data-testid': 'media-drawing-status'}, 'No lines.');
  const show = () => { status.textContent = lines.length ? `${lines.length} line${lines.length === 1 ? '' : 's'}.` : 'No lines.'; };
  view.addEventListener('pointerdown', (e) => {
    line = [view.toCanvasPoint(e)];
    lines.push(line);
    view.setPointerCapture(e.pointerId);
    view.invalidate();
    show();
  });
  view.addEventListener('pointermove', (e) => {
    if (!line) { return; }
    // Many pointer events in one frame cause one draw
    line.push(view.toCanvasPoint(e));
    view.invalidate();
  });
  const end = () => { line = null; };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  const clear = button('media-drawing-clear', 'Clear', () => { lines.length = 0; view.invalidate(); show(); });
  return card('media-drawing', 'Canvas view: draw with the pointer', view, el('div', {class: 'controls'}, clear, status));
}

function videoCanvasCard() {
  const player = el('shadow-video-player', {src: '/media/sample.webm', label: 'Source video', loop: '', 'data-testid': 'media-effect-player'});
  const view = el('shadow-canvas-view', {label: 'The video in gray, with a line that moves', 'data-testid': 'media-effect-view'});
  view.style.setProperty('--zest-canvas-view-height', '11em');
  view.source = player;
  // The effect reads the pixels of each frame
  view.contextOptions = {willReadFrequently: true};
  const effect = el('select', {'aria-label': 'Effect', 'data-testid': 'media-effect-select'},
    new Option('Gray', 'gray', true, true), new Option('Invert', 'invert'), new Option('None', 'none'));
  effect.addEventListener('change', () => view.invalidate());
  view.draw = (context, {width, height, pixelRatio, source}) => {
    const rect = drawVideoFrame(context, source, {width, height});
    if (!rect) { return; }
    if (effect.value !== 'none') {
      const x = Math.round(rect.x * pixelRatio);
      const y = Math.round(rect.y * pixelRatio);
      const w = Math.round(rect.width * pixelRatio);
      const h = Math.round(rect.height * pixelRatio);
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      const image = context.getImageData(x, y, w, h);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        if (effect.value === 'gray') {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          data[i] = data[i + 1] = data[i + 2] = gray;
        } else {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
      }
      context.putImageData(image, x, y);
      context.restore();
    }
    const progress = source.duration ? source.currentTime / source.duration : 0;
    context.fillStyle = '#ffd400';
    context.fillRect(rect.x, rect.y + rect.height - 4, rect.width * progress, 4);
  };
  return wide(card('media-video-canvas', 'Video canvas: the frames of a video, with an effect',
    el('p', {}, 'The canvas draws each new frame of the player. Play the video to see the effect.'),
    el('div', {class: 'media-pair'}, player, view),
    el('label', {}, 'Effect ', effect)));
}

function imageCard() {
  const view = el('image-view', {src: '/media/pattern.png', alt: 'A test pattern of colored bars and a circle', 'data-testid': 'media-image-view'});
  view.style.setProperty('--zest-image-view-height', '14em');
  return card('media-image', 'Image view with zoom', view,
    el('p', {}, 'With the focus on the image: plus and minus zoom, zero resets, and the arrow keys move. Ctrl and the wheel zoom at the pointer.'));
}

const pairStyles = `
.card canvas-view, .card shadow-canvas-view { border: 1px solid var(--zest-color-border, CanvasText); border-radius: var(--zest-control-radius, 0.375em); background: var(--zest-color-field, Field); color: var(--zest-color-field-text, FieldText); }
.media-pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16em), 1fr)); gap: 0.5em; align-items: start; }
`;

export const section = {
  id: 'media',
  title: 'Media',
  render: () => {
    const style = el('style', {}, pairStyles);
    return [videoCard(), audioCard(), animationCard(), drawingCard(), videoCanvasCard(), imageCard(), style];
  },
};
