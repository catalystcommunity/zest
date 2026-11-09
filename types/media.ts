// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { defineMediaElements, drawVideoFrame, formatTime, type AudioTrack } from '@catalystcommunity/media';

defineMediaElements();

const video = document.createElement('video-player');
video.src = '/media/talk.webm';
video.captions = [{src: '/media/talk.vtt', srclang: 'en', label: 'English', default: true}];
video.addEventListener('video-player-timeupdate', (e) => { console.log(formatTime(e.detail.currentTime)); });
void video.play();
video.toggleCaptions(true);

const audio = document.createElement('audio-player');
const tracks: AudioTrack[] = [{src: '/music/one.ogg', title: 'One'}, {src: '/music/two.ogg', title: 'Two'}];
audio.tracks = tracks;
audio.loop = true;
audio.addEventListener('audio-player-track', (e) => { console.log(e.detail.index, e.detail.reason, e.detail.track?.title); });
audio.selectTrack(1, {play: false});

const view = document.createElement('canvas-view');
view.animated = true;
view.source = video;
view.draw = (context: CanvasRenderingContext2D, {width, height, source}) => {
    if (source) {
        const rect = drawVideoFrame(context, source, {width, height, fit: 'contain'});
        if (rect) { context.strokeRect(rect.x, rect.y, rect.width, rect.height); }
    }
};
view.addEventListener('pointermove', (e) => {
    const point = view.toCanvasPoint(e);
    if (point.inside) { view.invalidate(); }
});

const image = document.createElement('image-view');
image.src = '/photos/map.png';
image.alt = 'A map of the city center';
image.addEventListener('image-view-zoom', (e) => { console.log(e.detail.zoom, e.detail.fit); });
image.zoomTo(2);
