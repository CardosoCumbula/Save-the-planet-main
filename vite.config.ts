import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite automatically exposes VITE_-prefixed variables from .env files via
// import.meta.env (see .env.example). No API keys are injected from config.
export default defineConfig({
    server: {
        port: 3000,
        host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        }
    }
});
