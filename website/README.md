# Zest Demo Site

The demo site is at <https://zest.catalystsquad.com>. It is the demo application in `demo/`, built from the packages in this repository. It does not use the packages on npm.

| Path | What it shows |
| --- | --- |
| `/` | What Zest is, a live component and its source, and how to install Zest |
| `/gallery` | Each package, with live components |
| `/examples/desktop`, `/examples/spreadsheet`, `/examples/scale-lab` | The examples |

## Build and Preview

```sh
./tools.sh site build
python3 -m http.server 4180 --directory website/root
```

The build writes the site to `website/root/`. Git ignores this directory.

The host serves files only. It has no fallback to `index.html`. Thus the build writes a copy of `index.html` at each path of the application, for example `examples/desktop/index.html`. `demo/site-routes.js` gives the paths. If you add a route to `demo/main.js`, add its path there too. `e2e/site.spec.js` fails if a link in the menu has no file.

The host sends a path with no slash at the end, such as `/gallery`, to `/gallery/`. The router reads the two paths as the same page.

## Deployment

The site has its own version. The tag `website/vX.Y.Z` holds it. semver-tags computes the next version from the commits since the last `website/v*` tag, the same as for a package:

- A commit that changes one of these paths can release the site: `website`, `demo`, `packages`, `src`, `public`, `vite.config.js`, `package.json`, and `package-lock.json`.
- `feat` gives a minor release. `fix`, `perf`, `revert`, `docs`, `refactor`, and `style` give a patch release. Other types do not release the site.
- `./tools.sh site plan` shows the next site version. It changes nothing in the source tree.

The `zest-website-deploy` node is in the `zest-release` workflow. It runs after each merge to `main`, when the tests and the audit pass. It does not wait for the package release. It does these steps:

1. It computes the next site version. If there is no new version, it stops.
2. It builds the site into `website/root/`.
3. It builds a multi-architecture image from `website/Dockerfile` and pushes it to `containers.catalystsquad.com/public/catalystcommunity/zest-website`.
4. It installs the `catalyst-helm/pysocha-site` chart in the `zest-website` namespace, with the chart Ingress off. The Ingress conflicts with the Gateway listeners of the cluster.
5. It applies `website/httproute.yaml`.
6. It pushes the `website/vX.Y.Z` tag. The tag is the last step, so a failed deploy pushes no tag, and a retry computes the same version.

The chart mounts its own Caddyfile. `website/Caddyfile` is for a local run of the image only.

The deploy node needs the grants for `catalystcommunity/ci`, `catalystcommunity/registry`, and `catalystcommunity/k8s` in `.reactorcide/secret-grants.yaml`.

## Run the Image Locally

```sh
./tools.sh site build
docker build -t zest-website:local website/
docker run --rm -p 8080:80 zest-website:local
```
