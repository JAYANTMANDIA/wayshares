import express from 'express';
import { registerApi } from './api';

export function createExpressApp() {
  const app = express();
  app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '1mb' }));
  registerApi(app);
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ success: false, error: `No API route for ${req.method} ${req.path}` });
    }
    res.status(404).end();
  });
  return app;
}
