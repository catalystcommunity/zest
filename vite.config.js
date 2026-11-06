import { copyFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'
import { sitePaths } from './demo/site-routes.js'

// A copy of index.html at each path of the application, so that a plain file server can serve
// a link to any page. The router reads the path in the browser.
function routePages() {
    let outDir
    return {
        name: 'zest-route-pages',
        apply: 'build',
        configResolved(config) { outDir = resolve(config.root, config.build.outDir) },
        closeBundle() {
            for (const path of sitePaths()) {
                mkdirSync(join(outDir, path), { recursive: true })
                copyFileSync(join(outDir, 'index.html'), join(outDir, path, 'index.html'))
            }
        },
    }
}

export default defineConfig({
    // The demo application and the component gallery. The packages publish their own source.
    root: 'demo',
    publicDir: '../public',
    base: "/",
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        // With older targets, the build rewrites light-dark() to a media query for the whole page,
        // and then `color-scheme` on a part of the page does nothing
        cssTarget: ['chrome123', 'firefox120', 'safari17.5'],
    },
    server: {
        port: 4173,
        proxy: {
            '/api': {
                target: 'http://localhost:5000'
            }
        },
        watch: {
            usePolling: true,
        }
    },
    preview: {
        port: 4173,
        allowedHosts: true, 
        proxy: {
            '/api': {
                target: 'http://localhost:5000'
            }
        },
    },
    plugins: [
        // Serves both of the above over HTTPS, which an application with secure cookies needs
        basicSsl(),
        routePages(),
    ]
})
