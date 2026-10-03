import type { IncomingMessage, ServerResponse } from 'node:http';

export const config = {
  maxDuration: 10
};

let app: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
let loadError = '';

function sendJson(res: ServerResponse, status: number, body: object) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function loadApp() {
  if (app || loadError) return;
  try {
    const { createExpressApp } = await import('../backend/app');
    app = createExpressApp();
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Failed to start the API function';
    console.error('API function failed to load', error);
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await loadApp();
  if (!app) {
    sendJson(res, 500, {
      success: false,
      error: loadError || 'API function failed to start',
      hint: 'Set FIREBASE_SERVICE_ACCOUNT_JSON and FIREBASE_PROJECT_ID on Vercel (Production), then redeploy.'
    });
    return;
  }
  const url = req.url || '/';
  if (!url.startsWith('/api')) {
    req.url = url.startsWith('/') ? `/api${url}` : `/api/${url}`;
  }
  app(req, res);
}
