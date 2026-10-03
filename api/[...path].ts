import type { IncomingMessage, ServerResponse } from 'node:http';
import { createExpressApp } from '../backend/app';

const app = createExpressApp();

export const config = {
  maxDuration: 10
};

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '/';
  if (!url.startsWith('/api')) {
    req.url = url.startsWith('/') ? `/api${url}` : `/api/${url}`;
  }
  app(req, res);
}
