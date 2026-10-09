import { createApiApp, type ApiDependencies } from './api';
import { handleSignup } from './authSignup';

export function createPharmaTrackApp(dependencies: ApiDependencies = {}) {
  const app = createApiApp(dependencies);

  app.post('/api/auth/signup', (req, res, next) => {
    handleSignup(req, res).catch((error: unknown) => {
      console.error('Account creation request failed:', error);
      if (!res.headersSent) res.status(500).json({ error: 'Account creation failed unexpectedly.' });
      else next(error);
    });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

  return app;
}
