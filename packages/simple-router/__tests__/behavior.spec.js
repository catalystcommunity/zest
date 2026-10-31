import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SimpleRouter from '../src';

// A location that moves when the history does, which is what a browser does.
function fakeLocation(start = '/') {
    const provider = {
        location: {href: 'http://host.tld' + start},
        history: {
            pushState: vi.fn((_state, _title, path) => {
                provider.location.href = new URL(path, provider.location.href).href;
            }),
        },
    };
    return provider;
}

describe('SimpleRouter', () => {
    let sr;
    beforeEach(() => {
        sr = new SimpleRouter();
    });
    afterEach(() => {
        sr.cleanup();
    });

    describe('route matching', () => {
        it('does not match a route on part of a path segment', () => {
            const home = vi.fn();
            const fallback = vi.fn();
            sr.locationProvider = fakeLocation('/homepage');
            sr.registerRoute('/home', home);
            sr.registerRoute('/fallback', fallback, [], true);
            sr.route();
            expect(home).not.toHaveBeenCalled();
            expect(fallback).toHaveBeenCalledOnce();
        });

        it('matches a route on a whole leading path segment', () => {
            const home = vi.fn();
            sr.locationProvider = fakeLocation('/home/again');
            sr.registerRoute('/home', home);
            sr.route();
            expect(home).toHaveBeenCalledOnce();
        });

        it('does not let the root route take every path, in any order', () => {
            const root = vi.fn();
            const home = vi.fn();
            sr.locationProvider = fakeLocation('/home');
            sr.registerRoute('/', root);
            sr.registerRoute('/home', home);
            sr.route();
            expect(root).not.toHaveBeenCalled();
            expect(home).toHaveBeenCalledOnce();
        });

        it('takes the longest match, in any order', () => {
            const short = vi.fn();
            const long = vi.fn();
            sr.locationProvider = fakeLocation('/home/again/more');
            sr.registerRoute('/home', short);
            sr.registerRoute('/home/again', long);
            sr.route();
            expect(short).not.toHaveBeenCalled();
            expect(long).toHaveBeenCalledOnce();
        });

        it('ignores a route with an equivalent when the location is something else', () => {
            const home = vi.fn();
            const fallback = vi.fn();
            sr.locationProvider = fakeLocation('/elsewhere');
            sr.registerRoute('/home', home, ['/homeagain']);
            sr.registerRoute('/fallback', fallback, [], true);
            sr.route();
            expect(home).not.toHaveBeenCalled();
            expect(fallback).toHaveBeenCalledOnce();
        });

        it('gives the route data, the state, and the change type to the render function', () => {
            const home = vi.fn();
            sr.locationProvider = fakeLocation('/home?a=1');
            sr.registerRoute('/home', home);
            sr.route('direct', {from: 'test'});
            const [routeData, state, changeType] = home.mock.calls[0];
            expect(routeData.path).toEqual('/home');
            expect(routeData.params.get('a')).toEqual(['1']);
            expect(state).toEqual({from: 'test'});
            expect(changeType).toEqual('direct');
        });

        it('gives the same arguments to the default route', () => {
            const fallback = vi.fn();
            sr.locationProvider = fakeLocation('/nothing');
            sr.registerRoute('/fallback', fallback, [], true);
            sr.route();
            const [routeData, , changeType] = fallback.mock.calls[0];
            expect(routeData.path).toEqual('/nothing');
            expect(changeType).toEqual('direct');
        });
    });

    describe('registration', () => {
        it('puts the bad value in the error', () => {
            expect(() => sr.registerRoute('/home', 'notfunction')).toThrow(/notfunction/);
        });

        it('removes the equivalents of a route that it unregisters, and logs nothing', () => {
            const log = vi.spyOn(console, 'log');
            const other = vi.fn();
            sr.registerRoute('/home', () => {}, ['/homeagain']);
            sr.registerRoute('/other', other, ['/otheragain']);
            sr.unregisterRoute('/home');
            expect(sr.routeEquivalents.has('/homeagain')).toEqual(false);
            expect(sr.routeEquivalents.get('/otheragain')).toEqual('/other');
            expect(log).not.toHaveBeenCalled();
            log.mockRestore();
        });
    });

    describe('changePage', () => {
        it('pushes the state, sends the event, and routes', () => {
            const home = vi.fn();
            const sender = vi.fn();
            sr.locationProvider = fakeLocation('/');
            sr.eventSender = sender;
            sr.registerRoute('/home', home);
            sr.changePage('/home', {from: 'test'});
            expect(sr.locationProvider.history.pushState).toHaveBeenCalledWith({from: 'test'}, '', '/home');
            expect(sender.mock.calls[0][0]).toEqual('url-changed');
            expect(sender.mock.calls[0][1].routeData.path).toEqual('/home');
            expect(sender.mock.calls[0][1].state).toEqual({from: 'test'});
            expect(home.mock.calls[0][1]).toEqual({from: 'test'});
        });

        it('writes the main path for an equivalent path', () => {
            sr.locationProvider = fakeLocation('/');
            sr.registerRoute('/home', () => {}, ['/homeagain']);
            sr.changePage('/homeagain/more?a=1#b');
            expect(sr.locationProvider.history.pushState.mock.calls[0][2]).toEqual('/home/more?a=1#b');
        });

        it('does not change a path that only starts with the same letters as an equivalent', () => {
            sr.locationProvider = fakeLocation('/');
            sr.registerRoute('/home', () => {}, ['/homeagain']);
            sr.changePage('/homeagainandagain');
            expect(sr.locationProvider.history.pushState.mock.calls[0][2]).toEqual('/homeagainandagain');
        });
    });

    describe('browser events', () => {
        it('routes and sends one event on load', () => {
            const home = vi.fn();
            const sender = vi.fn();
            sr.locationProvider = fakeLocation('/home');
            sr.eventSender = sender;
            sr.registerRoute('/home', home);
            window.dispatchEvent(new Event('load'));
            expect(home).toHaveBeenCalledOnce();
            expect(home.mock.calls[0][2]).toEqual('urlchange');
            expect(sender).toHaveBeenCalledOnce();
        });

        it('routes on popstate with the state of the event', () => {
            const home = vi.fn();
            sr.locationProvider = fakeLocation('/home');
            sr.eventSender = vi.fn();
            sr.registerRoute('/home', home);
            window.dispatchEvent(new PopStateEvent('popstate', {state: {page: 2}}));
            expect(home.mock.calls[0][1]).toEqual({page: 2});
            expect(home.mock.calls[0][2]).toEqual('popstate');
        });

        it('gives an empty state on a popstate with no state', () => {
            const home = vi.fn();
            sr.locationProvider = fakeLocation('/home');
            sr.eventSender = vi.fn();
            sr.registerRoute('/home', home);
            window.dispatchEvent(new PopStateEvent('popstate', {state: null}));
            expect(home.mock.calls[0][1]).toEqual({});
        });

        it('routes one time when a hash navigation fires popstate and hashchange', () => {
            const home = vi.fn();
            sr.locationProvider = fakeLocation('/home#one');
            sr.eventSender = vi.fn();
            sr.registerRoute('/home', home);
            window.dispatchEvent(new PopStateEvent('popstate'));
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            expect(home).toHaveBeenCalledOnce();
        });

        it('routes on a hashchange when no popstate came first', () => {
            const home = vi.fn();
            sr.locationProvider = fakeLocation('/home#one');
            sr.eventSender = vi.fn();
            sr.registerRoute('/home', home);
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            expect(home).toHaveBeenCalledOnce();
        });

        it('stops listening after cleanup', () => {
            const home = vi.fn();
            sr.locationProvider = fakeLocation('/home');
            sr.eventSender = vi.fn();
            sr.registerRoute('/home', home);
            sr.cleanup();
            window.dispatchEvent(new Event('load'));
            window.dispatchEvent(new PopStateEvent('popstate'));
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            expect(home).not.toHaveBeenCalled();
        });

        it('sends the event on the document by default, where an EventBroker hears it', () => {
            const heard = vi.fn();
            document.addEventListener('url-changed', heard);
            sr.locationProvider = fakeLocation('/home');
            sr.changePage('/home');
            document.removeEventListener('url-changed', heard);
            expect(heard).toHaveBeenCalledOnce();
            expect(heard.mock.calls[0][0].detail.routeData.path).toEqual('/home');
        });
    });
});
