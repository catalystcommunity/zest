// A path with a leading slash and no trailing slash, so that paths compare the same way
function normalizePath(path) {
    let normalized = path.startsWith('/') ? path : '/' + path;
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

// A route matches its own path and the paths under it, on whole segments. So /home matches
// /home/again but not /homepage, and the root route matches only the root.
function pathMatches(currentPath, routePath) {
    const current = normalizePath(currentPath);
    const route = normalizePath(routePath);
    if (route === '/') {
        return current === '/';
    }
    return current === route || current.startsWith(route + '/');
}

export default class SimpleRouter {
    // The routes we have to functions we wish to call
    routes;
    // The default route as a fallback
    defaultRoute;
    // Things that map to the same route, so maybe / and /home are the same
    routeEquivalents;
    // Location provider should be window.location but let it be set afterward for testing
    locationProvider;
    // Sends the url-changed event. By default it goes on the document, where an EventBroker
    // subscriber hears it. Replace this to send it somewhere else.
    eventSender;
    // The last URL that a browser event routed, because a hash navigation fires popstate and hashchange
    #lastEventHref;

    constructor(){
        this.routes = new Map();
        this.defaultRoute = function(){};
        this.routeEquivalents = new Map();
        this.locationProvider = window;
        this.eventSender = (name, detail) => {
            document.dispatchEvent(new CustomEvent(name, {detail: detail}));
        };
        // The browser calls these with no "this", and cleanup needs the same function references
        this.urlChangeRouter = this.urlChangeRouter.bind(this);
        this.hashChangeRouter = this.hashChangeRouter.bind(this);
        this.popstateRouter = this.popstateRouter.bind(this);
        window.addEventListener('load', this.urlChangeRouter);
        window.addEventListener('hashchange', this.hashChangeRouter);
        window.addEventListener('popstate', this.popstateRouter);
    }
    cleanup(){
        window.removeEventListener('load', this.urlChangeRouter);
        window.removeEventListener('hashchange', this.hashChangeRouter);
        window.removeEventListener('popstate', this.popstateRouter);
    }

    // The actual router, get the current URL and generate the corresponding template
    route(changeType, state) {
        if(!changeType) { changeType = 'direct';}
        const routeData = this.getRouteData();
        const renderFunc = this.findRoute(routeData.path);
        // No registered route is found, so render the default, which by default is a no-op of course
        (renderFunc || this.defaultRoute)(routeData, state, changeType);
    }
    // The render function for a path. The longest match wins, so registration order does not matter.
    findRoute(path) {
        let best = null;
        let bestLength = -1;
        const consider = (routePath, mainPath) => {
            if (pathMatches(path, routePath) && routePath.length > bestLength && this.routes.has(mainPath)) {
                best = this.routes.get(mainPath);
                bestLength = routePath.length;
            }
        };
        for(const routePath of this.routes.keys()) {
            consider(routePath, routePath);
        }
        for(const [other, mainPath] of this.routeEquivalents) {
            consider(other, mainPath);
        }
        return best;
    }
    urlChangeRouter() {
        this.#lastEventHref = this.locationProvider.location.href;
        this.sendChangedEvent(this.getRouteData(), {}, 'urlchange');
        this.route('urlchange', {});
    };
    hashChangeRouter() {
        if (this.locationProvider.location.href === this.#lastEventHref) {
            return;
        }
        this.urlChangeRouter();
    };
    popstateRouter(e) {
        const state = e.state ?? {};
        this.#lastEventHref = this.locationProvider.location.href;
        this.sendChangedEvent(this.getRouteData(), state, 'popstate');
        this.route('popstate', state);
    };
    sendChangedEvent(routeData, state = {}, changeType = "unknown") {
        this.eventSender('url-changed', {routeData: routeData, state: state, changeType: changeType});
    };

    // The path needs to be including the /
    registerRoute(path, renderFunc, otherPaths = [], isdefault = false) {
        if(typeof renderFunc !== "function") {
            throw new Error(`Passed renderFunc to registerRoute that is not a function: ${renderFunc}`);
        }
        this.routes.set(path, renderFunc);
        for(const other of otherPaths) {
            this.routeEquivalents.set(other, path);
        }
        if (isdefault) {
            this.defaultRoute = renderFunc;
        }
    };
    // Unload a route, for whatever reason, I'm not your parent
    unregisterRoute(path) {
        let foundFunc = function(){};
        if (this.routes.has(path)) {
            foundFunc = this.routes.get(path);
            this.routes.delete(path);
        }
        for(const [other, mainPath] of this.routeEquivalents) {
            if (mainPath === path) {
                this.routeEquivalents.delete(other);
            }
        }
        // If we're taking out the route that is default, we should set the defaultRoute to a no-op
        if (foundFunc === this.defaultRoute) {
            this.defaultRoute = function(){};
        }
    };

    parsePathPairs(path, skip=1) {
        // The path can be interpreted as a series of key value pairs, so we are opting to provide that
        // functionality wit a helper item to make it easy to get things like an entity ID without
        // fancy templating, and by default we skip the first item, accounting for initial slash
        let pairs = new Map();
        let items = path.split("/")
        if (items[0] === ""){ skip++ }
        for(let i = skip; i < items.length; i = i+2) {
            let key = items[i];
            let val = items[i+1];
            if (!pairs.has(key)) {
                pairs.set(key, val);
            }
        }
        return pairs;
    }

    changePage(path, state = {}) {
        const target = this.mainPathFor(path);
        this.locationProvider.history.pushState(state, "", target);
        this.#lastEventHref = this.locationProvider.location.href;
        this.sendChangedEvent(this.getRouteData(), state, 'pushstate');
        this.route('pushstate', state);
    };
    // Write an equivalent path as its main path, and keep what follows it
    mainPathFor(path) {
        const pathEnd = path.search(/[?#]/);
        const pathOnly = pathEnd === -1 ? path : path.slice(0, pathEnd);
        const rest = pathEnd === -1 ? '' : path.slice(pathEnd);
        for(const [other, mainPath] of this.routeEquivalents) {
            if (pathMatches(pathOnly, other)) {
                return mainPath + normalizePath(pathOnly).slice(normalizePath(other).length) + rest;
            }
        }
        return path;
    }

    getRouteData() {
        const url = new URL(this.locationProvider.location.href);
        const params = new Map();
        let firstPath = "";
        let paths = url.pathname.split('/');
        if (paths.length > 1) {
            firstPath = paths[1];
        }
        for(const [key, val] of url.searchParams) {
            if (!params.has(key)) {
                params.set(key, []);
            }
            let vals = params.get(key); 
            vals.push(val);
        }

        const routeData = {
            path: url.pathname,
            firstPath: firstPath,
            hash: url.hash,
            params: params
        }
        return routeData;
    }
}
