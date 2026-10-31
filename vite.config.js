import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

export default defineConfig({
    // The demo application and the component gallery. The packages publish their own source.
    root: 'demo',
    publicDir: '../public',
    base: "/",
    build: {
        outDir: '../dist',
        emptyOutDir: true,
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
        basicSsl()
    ]
})
