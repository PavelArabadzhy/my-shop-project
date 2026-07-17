import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { VisitorService } from './visitor.service';

export interface RequestWithVisitorId extends Request {
  visitorId: string;
}

/**
 * Safety net applied to every route (except the explicit recovery endpoint):
 * guarantees that a visitor_id cookie exists on any response, even if the
 * frontend never called POST /visitor-id/recover first (e.g. direct API
 * hits, non-browser clients, race conditions on the very first page load).
 *
 * It never overwrites an existing cookie — it only creates one when missing.
 */
@Injectable()
export class VisitorMiddleware implements NestMiddleware {
  constructor(private readonly visitorService: VisitorService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const existingVisitorId = this.visitorService.getVisitorIdFromCookieHeader(
      req.headers.cookie,
    );

    const visitorId = existingVisitorId ?? this.visitorService.generateVisitorId();

    if (!existingVisitorId) {
      const isProduction = process.env.NODE_ENV === 'production';
      res.setHeader(
        'Set-Cookie',
        this.visitorService.buildVisitorCookieHeader(visitorId, isProduction),
      );
    }

    (req as RequestWithVisitorId).visitorId = visitorId;
    next();
  }
}
