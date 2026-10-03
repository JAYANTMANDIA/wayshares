import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createExpressApp } from './backend/app';

const localServerEnv = dotenv.config({ processEnv: {} }).parsed ?? {};
for (const [key, value] of Object.entries(localServerEnv)) {
  if (!key.startsWith('VITE_') && process.env[key] === undefined) {
    process.env[key] = value;
  }
}

async function startServer() {
  const app = createExpressApp();
  const port = Number(process.env.PORT) || 3000;
  const publicHost = (() => {
    try { return new URL(process.env.APP_URL || '').hostname; } catch { return ''; }
  })();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: publicHost ? [publicHost] : [] },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[UberX Backend API] listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Unable to start UberX backend', error);
  process.exitCode = 1;
});