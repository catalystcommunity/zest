// Type declarations for @catalystcommunity/simple-router. The source is JavaScript; keep this file
// in step with src/index.js. __tests__/types.spec.js checks that each export has a declaration.

export interface RouteData {
    /** The pathname of the URL. */
    path: string;
    /** The first segment of the path, with no slash. */
    firstPath: string;
    /** The hash, with its `#`, or empty. */
    hash: string;
    /** Each search parameter, with each of its values. */
    params: Map<string, string[]>;
}

/** What made the route run. A call of `route()` with no type is `direct`. */
export type RouteChangeType = 'direct' | 'urlchange' | 'popstate' | 'pushstate';

export type RenderFunc<State = unknown> = (routeData: RouteData, state: State, changeType: RouteChangeType) => void;

export interface UrlChangedDetail<State = unknown> {
    routeData: RouteData;
    state: State;
    changeType: RouteChangeType | 'unknown';
}

/** What the router reads the URL from and pushes history to. The default is `window`. */
export interface LocationProvider {
    location: {href: string};
    history: {pushState(data: unknown, unused: string, url?: string | URL | null): void};
}

export default class SimpleRouter<State = unknown> {
    /** The render function of each main path. */
    routes: Map<string, RenderFunc<State>>;
    /** Runs when no route matches. The default does nothing. */
    defaultRoute: RenderFunc<State>;
    /** Each equivalent path, with its main path. */
    routeEquivalents: Map<string, string>;
    locationProvider: LocationProvider;
    /** Sends `url-changed`. The default dispatches it on the document. */
    eventSender: (name: string, detail: UrlChangedDetail<State>) => void;
    /** Adds listeners for load, hashchange, and popstate on the window. */
    constructor();
    /** Removes the window listeners. */
    cleanup(): void;
    /** Runs the route of the current URL. */
    route(changeType?: RouteChangeType, state?: State): void;
    /** The render function for a path. The longest match wins. */
    findRoute(path: string): RenderFunc<State> | null;
    urlChangeRouter(): void;
    hashChangeRouter(): void;
    popstateRouter(event: {state?: unknown}): void;
    sendChangedEvent(routeData: RouteData, state?: State, changeType?: RouteChangeType | 'unknown'): void;
    /**
     * A path matches itself and the paths under it, on whole segments. `otherPaths` are equivalent
     * paths. With `isDefault`, the function is also the default route. Throws if `renderFunc` is not a function.
     */
    registerRoute(path: string, renderFunc: RenderFunc<State>, otherPaths?: Iterable<string>, isDefault?: boolean): void;
    unregisterRoute(path: string): void;
    /** Reads `/a/1/b/2` as a=1, b=2. `skip` is the count of segments to skip after the leading slash. A key with no value has undefined. */
    parsePathPairs(path: string, skip?: number): Map<string, string | undefined>;
    /** Pushes the main path of `path` to the history, sends `url-changed`, and runs the route. */
    changePage(path: string, state?: State): void;
    /** An equivalent path written as its main path, with the rest of the path, search, and hash. */
    mainPathFor(path: string): string;
    getRouteData(): RouteData;
}

declare global {
    interface DocumentEventMap {
        'url-changed': CustomEvent<UrlChangedDetail>;
    }
}
