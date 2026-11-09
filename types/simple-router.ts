// Uses the declarations as an application does. tsc checks it; nothing runs it.
import SimpleRouter, { type RouteData } from '@catalystcommunity/simple-router';

interface PageState { from?: string; }

const router = new SimpleRouter<PageState>();
router.registerRoute('/home', (routeData: RouteData, state, changeType) => {
    const id: string | undefined = router.parsePathPairs(routeData.path).get('item');
    const tabs: string[] = routeData.params.get('tab') ?? [];
    void [id, tabs, state.from, changeType === 'popstate'];
}, ['/start']);
router.registerRoute('/notfound', () => {}, [], true);
document.addEventListener('url-changed', (event) => { void event.detail.routeData.firstPath; });
router.changePage('/start/more', {from: 'menu'});
const main: string = router.mainPathFor('/start?x=1');
void main;
router.cleanup();
