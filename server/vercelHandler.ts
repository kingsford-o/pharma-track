import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';
import { createPharmaTrackApp } from './app';

const app = createPharmaTrackApp();

export function handleVercelApiRequest(request: IncomingMessage, response: ServerResponse) {
  app(request as Request, response as Response);
}
