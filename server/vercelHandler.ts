import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';

type PharmaTrackApp = ReturnType<typeof import('./app').createPharmaTrackApp>;

let appPromise: Promise<PharmaTrackApp> | undefined;

function getApp(): Promise<PharmaTrackApp> {
  appPromise ??= import('./app').then(({ createPharmaTrackApp }) => createPharmaTrackApp());
  return appPromise;
}

export async function handleVercelApiRequest(request: IncomingMessage, response: ServerResponse) {
  try {
    const incomingUrl = new URL(request.url ?? '/', 'http://localhost');
    const originalPath = incomingUrl.searchParams.get('__axellePath');

    if (originalPath !== null) {
      if (!originalPath.startsWith('/api/')) {
        response.statusCode = 400;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify({ error: 'Invalid API route forwarding request.' }));
        return;
      }

      incomingUrl.searchParams.delete('__axellePath');
      const query = incomingUrl.searchParams.toString();
      request.url = `${originalPath}${query ? `?${query}` : ''}`;
    }

    const app = await getApp();
    app(request as Request, response as Response);
  } catch (error) {
    console.error('Vercel API function failed before the request could be handled:', error);
    if (response.headersSent) {
      response.end();
      return;
    }
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: 'The API function failed to initialize. Check the Vercel function logs.' }));
  }
}
