// Media components: players for video and audio, a canvas that draws one time per frame, and an
// image view with zoom. The design is in the README.
import { defineElements } from '@catalystcommunity/base-components';
import { VideoPlayer, ShadowVideoPlayer, AudioPlayer, ShadowAudioPlayer } from './player.js';
import { CanvasView, ShadowCanvasView } from './canvas.js';
import { ImageView, ShadowImageView } from './image.js';

export { MediaPlayer, VideoPlayer, ShadowVideoPlayer, AudioPlayer, ShadowAudioPlayer } from './player.js';
export { CanvasView, ShadowCanvasView, drawVideoFrame, fitRect } from './canvas.js';
export { ImageView, ShadowImageView } from './image.js';
export { formatTime, spokenTime } from './time.js';

// Defines the default tag of each media component that has no tag yet. Importing defines nothing.
export function defineMediaElements() {
    defineElements({
        'video-player': VideoPlayer,
        'shadow-video-player': ShadowVideoPlayer,
        'audio-player': AudioPlayer,
        'shadow-audio-player': ShadowAudioPlayer,
        'canvas-view': CanvasView,
        'shadow-canvas-view': ShadowCanvasView,
        'image-view': ImageView,
        'shadow-image-view': ShadowImageView,
    });
}
