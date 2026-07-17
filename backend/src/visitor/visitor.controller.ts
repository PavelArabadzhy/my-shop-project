import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { RequestWithVisitorId } from './visitor.middleware';
import { VisitorService } from './visitor.service';

interface RecoverVisitorIdDto {
  visitorId?: string;
}

@Controller('visitor-id')
export class VisitorController {
  constructor(private readonly visitorService: VisitorService) {}

  /**
   * Returns the visitor_id currently assigned to this browser.
   * VisitorMiddleware guarantees the cookie already exists by the time
   * this handler runs, so there is always a value to return.
   */
  @Get()
  getVisitorId(@Req() req: RequestWithVisitorId) {
    return { visitorId: req.visitorId };
  }

  /**
   * Restores visitor_id after the cookie was lost (cleared by the user,
   * Safari ITP expiry, etc.) using the value the frontend remembered in
   * localStorage. Excluded from VisitorMiddleware so it has full control
   * over the create-vs-restore decision:
   *  - cookie already present                        -> return as-is
   *  - cookie missing + valid candidate from client   -> restore that value
   *  - cookie missing + no/invalid candidate          -> generate a new UUID
   */
  @Post('recover')
  recoverVisitorId(
    @Body() body: RecoverVisitorIdDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const existingVisitorId = this.visitorService.getVisitorIdFromCookieHeader(
      req.headers.cookie,
    );

    if (existingVisitorId) {
      return { visitorId: existingVisitorId };
    }

    const candidateVisitorId = body?.visitorId;
    const visitorId = this.visitorService.isValidVisitorId(candidateVisitorId)
      ? candidateVisitorId
      : this.visitorService.generateVisitorId();

    const isProduction = process.env.NODE_ENV === 'production';
    res.setHeader(
      'Set-Cookie',
      this.visitorService.buildVisitorCookieHeader(visitorId, isProduction),
    );

    return { visitorId };
  }
}
