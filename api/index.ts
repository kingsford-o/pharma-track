import { createApiApp } from '../server/api.js';
import { handleSignup } from '../server/authSignup.js';

const app = createApiApp();

app.post('/api/auth/signup', (req, res) => {
  handleSignup(req, res).catch((error: unknown) => {
    console.error('Account creation request failed:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Account creation failed unexpectedly.' });
  });
});

export default app;
