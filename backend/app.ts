import express from 'express';
import { registerApi } from './api';

export function createExpressApp() {
  const app = express();
  app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '1mb' }));
  registerApi(app);
  return app;
}
