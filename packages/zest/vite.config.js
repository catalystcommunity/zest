import basicSsl from '@vitejs/plugin-basic-ssl'

export default {
    server: {
        https: true,
        proxy: {
            '/api': {
                target: 'http://localhost:5000'
            }
        }
    },
    plugins: [
        basicSsl()
    ]
}
