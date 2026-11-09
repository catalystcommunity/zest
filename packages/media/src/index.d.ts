// Type declarations for @catalystcommunity/media. The source is JavaScript; keep this
// file in step with src/*.js. __tests__/types.spec.js checks that each export has a declaration.
import { BaseComponent } from '@catalystcommunity/base-components';

// Times

export interface TimeUnits {
    hour: [one: string, many: string];
    minute: [one: string, many: string];
    second: [one: string, many: string];
}

/** 65 gives '1:05', 3723 gives '1:02:03'. */
export declare function formatTime(seconds: number): string;
/** 65 gives '1 minute 5 seconds'. `units` changes the words. */
export declare function spokenTime(seconds: number, units?: TimeUnits): string;

// Players

/** The text of the players. Each field is optional in `labels`. */
export interface MediaPlayerLabels {
    controls: string;
    play: string;
    pause: string;
    seek: string;
    volume: string;
    mute: string;
    speed: string;
    captions: string;
    fullscreen: string;
    pictureInPicture: string;
    previous: string;
    next: string;
    playlist: string;
    of: string;
    muted: string;
    unmuted: string;
    volumePercent: (percent: number) => string;
    captionsOn: string;
    captionsOff: string;
    error: string;
    units: TimeUnits;
}

/** The `detail` of each relayed media event, for example `video-player-play`. */
export interface MediaPlayerState {
    currentTime: number;
    duration: number;
    paused: boolean;
    ended: boolean;
    volume: number;
    muted: boolean;
    playbackRate: number;
    src: string;
}

/** The elements that a player makes. Which ones exist depends on the player. */
export interface MediaPlayerParts {
    wrapper: HTMLDivElement;
    controls: HTMLDivElement;
    play: HTMLButtonElement;
    seek: HTMLInputElement;
    time: HTMLSpanElement;
    mute: HTMLButtonElement;
    volume: HTMLInputElement;
    rate: HTMLSelectElement;
    live: HTMLDivElement;
    message: HTMLDivElement;
    previous?: HTMLButtonElement;
    next?: HTMLButtonElement;
    captions?: HTMLButtonElement;
    pip?: HTMLButtonElement;
    fullscreen?: HTMLButtonElement;
    stage?: HTMLDivElement;
}

/** The parts that both players share. A child class gives the layout and the media element. */
export declare class MediaPlayer extends BaseComponent {
    /** The start of the name of each event, for example `video-player`. */
    static eventPrefix: string;
    /** The tag of the media element: `audio` or `video`. */
    static mediaTag: string;
    /** The media events that the player sends again as `<eventPrefix>-<name>`. */
    static RELAY: string[];

    src: string;
    autoplay: boolean;
    loop: boolean;
    muted: boolean;
    /** The name of the media. */
    label: string;
    labels: Partial<MediaPlayerLabels>;

    /** The media element, after the first connect. */
    readonly media: HTMLMediaElement | null;
    readonly parts: Partial<MediaPlayerParts>;
    /** The default labels with `labels` on top. */
    readonly text: MediaPlayerLabels;
    readonly paused: boolean;
    readonly duration: number;
    currentTime: number;
    volume: number;
    playbackRate: number;

    /** A child class puts the media element and the controls into the wrapper. */
    buildLayout(wrapper: HTMLDivElement, media: HTMLMediaElement): void;
    /** Makes the controls. A child class can add or leave out a control. */
    buildControls(options?: {fullscreen?: boolean; captions?: boolean; pictureInPicture?: boolean; playlist?: boolean}): DocumentFragment;
    /** The state that each event of the player gives in its detail. */
    state(): MediaPlayerState;
    /** The address that the media element plays. */
    currentSource(): string;
    loopsMedia(): boolean;
    showPlaying(): void;
    showTime(): void;
    showVolume(): void;
    /** Says the text in the live region. */
    announce(text: string): void;
    play(): Promise<void> | undefined;
    pause(): void;
    togglePlay(): Promise<void> | undefined;
    toggleMute(): void;
    seek(seconds: number): void;
    seekBy(seconds: number): void;
    volumeBy(step: number): void;
    /** A child class adds its own keys here. `key` is lower case for one character. Return true when the key is used. */
    handleKey(event: KeyboardEvent, key: string): boolean;
}

export interface CaptionTrack {
    src: string;
    srclang?: string;
    label?: string;
    /** The default is `captions`. */
    kind?: TextTrackKind;
    default?: boolean;
}

export declare class VideoPlayer extends MediaPlayer {
    readonly media: HTMLVideoElement | null;
    poster: string;
    /** Each one makes a `<track>`. The `<track>` children of the application stay. */
    captions: CaptionTrack[];
    /** During playback, the controls hide after the pointer stays still for this time, in ms. Attribute `hide-delay`. */
    hideDelay: number;
    readonly captionsOn: boolean;
    /** Returns the new state. */
    toggleCaptions(on?: boolean): boolean;
    toggleFullscreen(): Promise<void> | undefined;
    togglePictureInPicture(): Promise<unknown> | undefined;
}

export declare class ShadowVideoPlayer extends VideoPlayer {
    shadow: ShadowRoot;
}

export interface AudioTrack {
    src: string;
    title?: string;
}

export interface AudioPlayerTrackDetail {
    index: number;
    track: AudioTrack | null;
    reason: 'next' | 'previous' | 'select' | 'ended';
}

export declare class AudioPlayer extends MediaPlayer {
    readonly media: HTMLAudioElement | null;
    /** With tracks, `src` is not used. */
    tracks: AudioTrack[];
    /** Attribute `track-index`. */
    trackIndex: number;
    readonly track: AudioTrack | null;
    /** Goes to a track. It sends no event. */
    selectTrack(index: number, options?: {play?: boolean}): void;
    next(): void;
    previous(): void;
}

export declare class ShadowAudioPlayer extends AudioPlayer {
    shadow: ShadowRoot;
}

// Canvas

export type FitMode = 'contain' | 'cover' | 'fill';
export type CanvasContext = CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext;
/** A video element, a video player, an image, or another canvas. */
export type CanvasSource = HTMLVideoElement | VideoPlayer | HTMLImageElement | HTMLCanvasElement;

export interface CanvasDrawInfo {
    /** CSS pixels. */
    width: number;
    height: number;
    pixelRatio: number;
    /** The time of the frame, from `performance.now()`. */
    time: number;
    /** Milliseconds since the last draw. */
    delta: number;
    /** The count of frames drawn before this one. */
    frame: number;
    /** The media element of `source`, or null. */
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null;
    view: CanvasView;
}

/** A method type, so that a function for one context type, for example `CanvasRenderingContext2D`, fits. */
export type CanvasDraw = {draw(context: CanvasContext, info: CanvasDrawInfo): void}['draw'];

export interface CanvasPoint {
    /** CSS pixels from the top left of the canvas. */
    x: number;
    y: number;
    pixelX: number;
    pixelY: number;
    inside: boolean;
}

export interface CanvasStats {
    framesDrawn: number;
    lastDrawMs: number;
    totalDrawMs: number;
    invalidations: number;
    averageDrawMs: number;
}

export interface FitRectangle { x: number; y: number; width: number; height: number; }

/** The rectangle of a source in a box. With no source size, or `fill`, the full box. */
export declare function fitRect(sourceWidth: number, sourceHeight: number, width: number, height: number, fit?: FitMode | string): FitRectangle;
/** Draws the current frame of a video, image, or canvas into a 2D context. Returns null when the source has no frame yet. */
export declare function drawVideoFrame(context: CanvasRenderingContext2D, source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas, box?: {width?: number; height?: number; fit?: FitMode | string}): FitRectangle | null;

/** A canvas that draws at most one time in each frame. */
export declare class CanvasView extends BaseComponent {
    label: string;
    description: string;
    /** `2d`, `webgl`, or `webgl2`. Attribute `context`. Set it before the first draw. */
    contextType: '2d' | 'webgl' | 'webgl2' | string;
    /** The options of `getContext`, for example `{willReadFrequently: true}`. */
    contextOptions: CanvasRenderingContext2DSettings | WebGLContextAttributes | null;
    /** Draws again in each frame while the canvas is visible. Attribute `animate`. */
    animated: boolean;
    /** The animation continues with reduced motion. Attribute `essential-motion`. */
    essentialMotion: boolean;
    /** Puts the canvas in the tab order. */
    focusable: boolean;
    /** Clears a 2D canvas before each draw. Attribute `auto-clear`. */
    autoClear: boolean;
    /** A number in place of the pixel ratio of the screen. 0 uses the screen. */
    pixelRatio: number;
    /** In a 2D context, `draw` uses CSS pixels. The context type follows `contextType`. */
    draw: CanvasDraw | null;
    /** A video to draw. The view draws again for each new video frame. */
    source: CanvasSource | null;
    /** How `source` fits when there is no `draw`. */
    fit: FitMode | string;

    readonly canvas: HTMLCanvasElement | null;
    /** CSS pixels. */
    readonly width: number;
    readonly height: number;
    readonly framesDrawn: number;
    readonly lastDrawMs: number;
    readonly stats: CanvasStats;
    resetStats(): void;
    /** True while the animation runs. */
    readonly running: boolean;
    /** The context. The first read makes it. */
    readonly context: CanvasContext | ImageBitmapRenderingContext | null;
    /** The point of a pointer event in CSS pixels of the canvas, and in device pixels. */
    toCanvasPoint(event: {clientX: number; clientY: number}): CanvasPoint;
}

export declare class ShadowCanvasView extends CanvasView {
    shadow: ShadowRoot;
}

// Image

export type ImageFit = 'contain' | 'cover' | 'actual';

export interface ImageViewLabels {
    tools: string;
    zoomIn: string;
    zoomOut: string;
    fit: string;
    contain: string;
    cover: string;
    actual: string;
    zoom: (percent: number) => string;
    help: string;
}

export interface ImageViewZoomDetail {
    zoom: number;
    /** Image pixels to CSS pixels, with the zoom. */
    scale: number;
    fit: ImageFit;
}

export declare class ImageView extends BaseComponent {
    src: string;
    /** Necessary. Use `''` only for a picture with no meaning. */
    alt: string | null;
    fit: ImageFit;
    /** The zoom of the fit size. */
    zoom: number;
    /** Attribute `min-zoom`. */
    minZoom: number;
    /** Attribute `max-zoom`. */
    maxZoom: number;
    /** The factor of one step of zoom. Attribute `zoom-step`. */
    zoomStep: number;
    labels: Partial<ImageViewLabels>;

    readonly text: ImageViewLabels;
    readonly image: HTMLImageElement | null;
    readonly offset: {x: number; y: number};
    /** Image pixels to CSS pixels, with the zoom. */
    readonly scale: number;
    /** Zooms and keeps the point (x, y) of the view in place. With no point, the center stays. */
    zoomTo(zoom: number, x?: number, y?: number): void;
    /** Moves the image by CSS pixels. */
    panBy(dx: number, dy: number): void;
    /** Goes back to the fit size. */
    reset(): void;
}

export declare class ShadowImageView extends ImageView {
    shadow: ShadowRoot;
}

/** Defines the default tag of each media component that has no tag yet. */
export declare function defineMediaElements(): void;

type PlayerEvents<P extends string> = {
    [K in 'play' | 'pause' | 'ended' | 'seeked' | 'volumechange' | 'ratechange' | 'timeupdate' | 'loadedmetadata' | 'error' as `${P}-${K}`]: CustomEvent<MediaPlayerState>;
};

declare global {
    interface HTMLElementTagNameMap {
        'video-player': VideoPlayer;
        'shadow-video-player': ShadowVideoPlayer;
        'audio-player': AudioPlayer;
        'shadow-audio-player': ShadowAudioPlayer;
        'canvas-view': CanvasView;
        'shadow-canvas-view': ShadowCanvasView;
        'image-view': ImageView;
        'shadow-image-view': ShadowImageView;
    }
    interface HTMLElementEventMap extends PlayerEvents<'video-player'>, PlayerEvents<'audio-player'> {
        'audio-player-track': CustomEvent<AudioPlayerTrackDetail>;
        'image-view-zoom': CustomEvent<ImageViewZoomDetail>;
    }
}
