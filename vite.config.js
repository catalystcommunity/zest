import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

export default defineConfig({
    base: "/",
    server: {
        https: true,
        proxy: {
            '/api': {
                target: 'http://localhost:5000'
            }
        }
    },
    preview: {
        https: true,

        port: 4173,
        allowedHosts: true, 
        proxy: {
            '/api': {
                target: 'http://localhost:5000'
            }
        }
    },
    plugins: [
        basicSsl()
    ]
})
