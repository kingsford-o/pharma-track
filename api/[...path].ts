import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';
import { createPharmaTrackApp } from '../server/app';

const app = createPharmaTrackApp();

export default function handler(request: IncomingMessage, response: ServerResponse) {
  app(request as Request, response as Response);
}
