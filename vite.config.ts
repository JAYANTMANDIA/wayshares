import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

const firebaseEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const isConfiguredValue = (value: string | undefined) => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return false;
  return !/^(your[-_ ]|replace[-_ ]|paste|placeholder)/i.test(trimmedValue);
};

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const missingFirebaseEnv = firebaseEnvKeys.filter(key => !isConfiguredValue(env[key]));
  if (command === 'build' && missingFirebaseEnv.length) {
    throw new Error(`Cannot build the frontend. Set valid Firebase client variables: ${missingFirebaseEnv.join(', ')}.`);
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Proxy /api/* to the backend Express server in development.
      // The full server (Express + Vite) runs together via `npm run dev`.
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          configure: (proxy: any) => {
            proxy.on('proxyReq', (_proxyReq: any, req: any) => {
              if (req.url?.includes('/stream')) {
                req.socket?.setNoDelay?.(true);
              }
            });
          },
        },
      },
    },
  };
});
