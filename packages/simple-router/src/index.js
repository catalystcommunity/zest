export default class SimpleRouter {
    // The routes we have to functions we wish to call
    routes;
    // The default route as a fallback
    defaultRoute;
    // Things that map to the same route, so maybe / and /home are the same
    routeEquivalents;
    // Location provider should be window.location but let it be set afterward for testing
    locationProvider

    constructor(){
        this.routes = new Map();
        this.defaultRoute = function(){};
        this.routeEquivalents = new Map();
        this.locationProvider = window;
        window.addEventListener('load', this.urlChangeRouter);
        window.addEventListener('hashchange', this.urlChangeRouter);
        window.addEventListener('popstate', this.popstateRouter);
    }
    cleanup(){
        window.removeEventListener('load', this.router);
        window.removeEventListener('hashchange', this.router);
        window.removeEventListener('popstate', this.popstateRouter);
    }

    // The actual router, get the current URL and generate the corresponding template
    route(changeType) {
        if(!changeType) { changeType = 'direct';}
        let routeData = this.getRouteData();
        for(const [path, renderFunc] of this.routes){
            let found = routeData.path.indexOf(path);
            // We found the path, call the renderFunc with the data and changetype
            if(found == 0 || found == 1) {
                renderFunc(this.getRouteData(), undefined, changeType);
                return;
            }
            // Look for equivalents
            for(const [_, mainpath] of this.routeEquivalents){
                if(path == mainpath) {
                    renderFunc(this.getRouteData(), undefined, changeType);
                    return;
                }
            }
        }
        // No registered route is found, so render the default, which by default is a no-op of course
        this.defaultRoute();
    }
    urlChangeRouter() {
        sendChangedEvent(this.getRouteData(), {}, 'urlchange');
        this.route('urlchange');
    };
    popstateRouter(e) {
        sendChangedEvent(this.getRouteData(), e.state, 'popstate');
        this.route('popstate');
    };
    sendChangedEvent(routeData, state = {}, changeType = "unknown") {
        this.eventSender('url-changed', {routeData: routeData, state: state, changeType: changeType});
    };

    // The path needs to be including the /
    registerRoute(path, renderFunc, otherPaths = [], isdefault = false) {
        if(typeof renderFunc !== "function") {
            throw new Error('Passed renderFunc to registerRoute that is not a function: ', renderFunc);
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
        this.routeEquivalents.forEach((other, route) => { console.log('other:', other, 'route:', route)
            if (route === path) {
                this.routeEquivalents.delete(other);
            }
        });
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
        let firstPath = url.split('/')[1]
        if (routeEquivalents.has(firstPath)) {
          url = url.replace(firstPath, routeEquivalents.get(firstPath) || firstPath);
        }
        this.locationProvider.history.pushState(state, "", path);
        sendChangedEvent(this.locationProvider.location.pathname, state);
    };
      
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
