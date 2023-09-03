import { describe, it, expect } from 'vitest';
import SimpleRouter from '../src';

describe('SimpleRouter', () => {
    let locationProvider = {};
    let foo = "bar";
    beforeEach(() => {
        locationProvider = {
            history: {
                pushState: function(){}
            },
            location: {
                href: "http://unimportant.host.tld/home"
            }
        };
        foo = "bar";
    });
    it("should initialize correctly", () => {
        const sr = new SimpleRouter();
        expect(sr).toBeInstanceOf(SimpleRouter);
        expect(sr.routes).toBeInstanceOf(Map);
        expect(typeof sr.defaultRoute).toBe("function");
        expect(sr.routeEquivalents).toBeInstanceOf(Map);
    });

    it("should register a route", () => {
        const sr = new SimpleRouter();
        sr.registerRoute("/home", function(){foo="baz"}, [], false)
        expect(sr.routes.has("/home")).toEqual(true);
        expect(typeof sr.defaultRoute).toBe("function");
        expect(sr.routeEquivalents.size).toEqual(0);
        expect(foo).toBe("bar");
        sr.defaultRoute();
        expect(foo).toBe("bar");
    });

    it("should register a default route", () => {
        const sr = new SimpleRouter();
        sr.registerRoute("/home", function(){foo="baz"}, [], true)
        expect(sr.routes.has("/home")).toEqual(true);
        expect(typeof sr.defaultRoute).toBe("function");
        expect(sr.routeEquivalents.size).toEqual(0);
        expect(foo).toBe("bar");
        sr.defaultRoute();
        expect(foo).toBe("baz");
    });

    it("should route to the registered route", () => {
        const sr = new SimpleRouter();
        sr.registerRoute("/home", function(){foo="baz"}, [], false)
        sr.locationProvider = locationProvider;
        expect(sr.routes.has("/home")).toEqual(true);
        expect(typeof sr.defaultRoute).toBe("function");
        expect(sr.routeEquivalents.size).toEqual(0);
        expect(foo).toBe("bar");
        locationProvider.location.href = "http://unimportant.host.tld/home";
        sr.route();
        expect(foo).toBe("baz");
    });

    it("should route to the default route when the route isn't found", () => {
        const sr = new SimpleRouter();
        sr.registerRoute("/home", function(){foo="baz"}, [], false)
        sr.registerRoute("/", function(){foo="defaulted"}, [], true)
        sr.locationProvider = locationProvider;
        expect(sr.routes.has("/home")).toEqual(true);
        expect(sr.routes.has("/")).toEqual(true);
        expect(typeof sr.defaultRoute).toBe("function");
        expect(sr.routeEquivalents.size).toEqual(0);
        expect(foo).toBe("bar");
        locationProvider.location.href = "http://unimportant.host.tld/foo";
        sr.route();
        expect(foo).toBe("defaulted");
    });

    it("should route to the equivalent route", () => {
        const sr = new SimpleRouter();
        sr.registerRoute("/home", function(){foo="baz"}, ["/homeagain", "/homeanother"], false)
        sr.registerRoute("/", function(){foo="defaulted"}, [], true)
        sr.locationProvider = locationProvider;
        expect(sr.routes.has("/home")).toEqual(true);
        expect(sr.routes.has("/homeagain")).toEqual(false);
        expect(sr.routeEquivalents.has("/homeagain")).toEqual(true);
        expect(sr.routeEquivalents.get("/homeagain")).toEqual("/home");
        expect(sr.routes.has("/")).toEqual(true);
        expect(typeof sr.defaultRoute).toBe("function");
        expect(sr.routeEquivalents.size).toEqual(2);
        expect(foo).toBe("bar");
        locationProvider.location.href = "http://unimportant.host.tld/homeagain";
        sr.route();
        expect(foo).toBe("baz");
    });

    it("should unregister a route", () => {
        const sr = new SimpleRouter();
        sr.registerRoute("/home", function(){foo="baz"}, [], false)
        sr.locationProvider = locationProvider;
        expect(sr.routes.has("/home")).toEqual(true);
        expect(typeof sr.defaultRoute).toBe("function");
        expect(sr.routeEquivalents.size).toEqual(0);
        expect(foo).toBe("bar");
        locationProvider.location.href = "http://unimportant.host.tld/home";
        sr.route();
        expect(foo).toBe("baz");
        sr.unregisterRoute("/home");
        foo = "bar";
        expect(sr.routes.has("/home")).toEqual(false);
        expect(typeof sr.defaultRoute).toBe("function");
        sr.route();
        expect(foo).toBe("bar");
    });

    it("should give paths for the right default path skip", () => {
        const sr = new SimpleRouter();
        sr.locationProvider = locationProvider;
        expect(sr.routes.size).toEqual(0);
        expect(sr.routeEquivalents.size).toEqual(0);
        let path = "/users/userid/17/address/12";
        let pairs = sr.parsePathPairs(path);
        expect(pairs.size).toEqual(2);
        expect(pairs.has("userid")).toEqual(true);
        expect(pairs.get("userid")).toEqual("17");
        expect(pairs.has("address")).toEqual(true);
        expect(pairs.get("address")).toEqual("12");
    });

    it("should give paths for the extra path skip", () => {
        const sr = new SimpleRouter();
        sr.locationProvider = locationProvider;
        expect(sr.routes.size).toEqual(0);
        expect(sr.routeEquivalents.size).toEqual(0);
        let path = "/settings/admin/users/userid/17/address/12/key/val";
        let pairs = sr.parsePathPairs(path, 3);
        expect(pairs.size).toEqual(3);
        expect(pairs.has("userid")).toEqual(true);
        expect(pairs.get("userid")).toEqual("17");
        expect(pairs.has("address")).toEqual(true);
        expect(pairs.get("address")).toEqual("12");
    });
});
