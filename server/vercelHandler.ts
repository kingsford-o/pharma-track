import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';
import { createPharmaTrackApp } from './app';

const app = createPharmaTrackApp();

export function handleVercelApiRequest(request: IncomingMessage, response: ServerResponse) {
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

  app(request as Request, response as Response);
}
