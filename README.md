# zest

Custom elements and helper libraries from Catalyst. Each package has its own version on npm.

## Status

This project is experimental. Use it at your own risk.

## Use a package

Install one package, or install the umbrella package, `@catalystcommunity/zest`, which exports all of them.

```js
import { MenuItem, ShadowMenuItem } from '@catalystcommunity/menu-item';

customElements.define('menu-item', MenuItem);
```

No package defines an element when you import it. You select the tag names. Components that have a shadow DOM version export it as `Shadow<Name>`.

A `two-tier-menu` makes `menu-item`, `menu-logo`, and `menu-gutter` elements. Define these three tags. You can define them before or after the menu renders.

## Set up

You need Node 22.22 or newer. You need [uv](https://docs.astral.sh/uv/) only for `./tools.sh`.

```sh
npm install
npm run e2e:install   # one time, to get headless Chromium
```

## Run the demo and the gallery

```sh
npm run dev
```

Open <https://localhost:4173>. The certificate is self-signed, so your browser shows a warning one time.

| Path | What it shows |
| --- | --- |
| `/` | A small application that uses the components together |
| `/gallery` | Every package, on one page |
| `/gallery/<package>` | One package, for example `/gallery/menu-item` |

The page reloads when you change a file in `packages/`, `src/`, or `demo/`.

## Run the tests

All tests run headless.

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests in jsdom. This takes about two seconds. |
| `npm run test:watch` | Unit tests. They run again when a file changes. |
| `npm run test:e2e` | Builds the demo, then runs the browser tests in headless Chromium. |
| `npm run test:e2e:browsers` | The browser tests in Chromium, Firefox, and WebKit. Run `npx playwright install firefox webkit` one time. WebKit does not run on every Linux, so see [the container command](#run-all-browsers-in-a-container). |
| `npm run test:e2e:headed` | The browser tests in a browser that you can see. |
| `npm run test:e2e:ui` | The Playwright UI, to go through one test step by step. |
| `npm run test:all` | The unit tests and the browser tests. |

The browser tests use port 4174, so you can run them while `npm run dev` runs. A browser test fails on an uncaught exception, a console error, or a failed request.

To use a different DOM in one unit test file, add a [`@vitest-environment`](https://vitest.dev/config/#environment) comment. The `jsdom` and `happy-dom` environments are installed.

### Run all browsers in a container

CI runs Chromium only. Run this before you change the browser behavior of a component. The version in the image name must be the version of `@playwright/test`.

```sh
docker run --rm -v "$PWD:/src:ro" -w /work mcr.microsoft.com/playwright:v1.64.1-noble \
  sh -c 'cp -a /src/. . && rm -rf node_modules && npm ci && npm run test:e2e:browsers'
```

## Add a package

```sh
./mknewpackage.sh SomePackageName
```

The script tells you what to do next. `npm test` and `npm run test:e2e` fail until the umbrella package exports the new package and the gallery has a section for it.

## Commits and releases

The release calculates each version from the conventional commits since the last tag of that package. A commit changes the packages whose files it changes.

| Commit type | Result |
| --- | --- |
| `feat` | Minor release |
| `fix`, `perf`, `revert` | Patch release |
| `!` after the type, or `BREAKING CHANGE` in the body | Major release |
| `build`, `chore`, `ci`, `docs`, `norelease`, `refactor`, `style`, `test` | No release |

A pull request fails if a commit has a different form. Each released package needs an approval from a person, so a change that a consumer cannot see does not make a release.

## CI

All CI runs on [Reactorcide](https://github.com/catalystcommunity/reactorcide). There are no GitHub Actions. The files are in `.reactorcide/`.

| Workflow | When | What it does |
| --- | --- | --- |
| `pr.yaml` | A pull request opens or changes | Commit check, unit tests, builds, browser tests, audit |
| `main.yaml` | A direct push to `main` | The same checks, with no commit check |
| `release.yaml` | A pull request merges | The same checks, then the release |

Each job calls `./tools.sh`, so you can run the same check on your machine. Run `./tools.sh` with no arguments to see all the verbs.

```sh
./tools.sh check                                      # each check, with the pinned Node
reactorcide run-local .reactorcide/jobs/test-e2e.yaml # one job, in the runner image
```

If `reactorcide run-local` cannot evaluate a workflow file (`No such option: --workflow-file`), add `--eval-image containers.catalystsquad.com/public/reactorcide/runnerbase:latest`.

## Publish

The release job does these steps in this sequence:

1. Calculate the versions from the head of `main`, and write them to the `package.json` files.
2. Build and examine a tarball for each released package.
3. Make sure that npm accepts the token and each tarball. If npm does not accept them, the job stops. Nothing is public at this step.
4. Commit the versions, then push the commit and the tags (`<package>/v<version>`) in one atomic operation.
5. Stage each tarball with `npm stage publish`.

The CI token cannot publish a package directly. A maintainer must approve each staged package with 2FA:

```sh
npm stage list
npm stage approve <stage-id>   # or reject it: npm stage reject <stage-id>
```

`npm stage` needs npm 11.16 or newer. Run `npm --version` to see your version. After `./tools.sh deps`, a new enough npm is in `.deps/node-*/bin`. You can also approve on npmjs.com.

Staging cannot create a package. A maintainer publishes each new package one time, by hand. This command makes the tarballs and prints the commands. It does not publish:

```sh
./tools.sh release first-publish
```

`./tools.sh release plan` shows what the next release would be, and changes nothing.

## Troubleshooting

* `Uncaught Error: Illegal Constructor`: you did not call `customElements.define("my-element", MyElement);`.
* A `menu-item` in a menu shows nothing: you did not define the `menu-item` tag.
