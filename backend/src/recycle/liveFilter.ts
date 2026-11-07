// SQL condition that hides Recycle Bin rows from a list route.
// Safe to concatenate into SQL: it never contains user input. The only thing read from the
// request is whether query.includeDeleted is exactly the string 'true'; `alias` is a literal
// written in the calling route.
import type { Request } from 'express';

export function liveOnly(req: Request, alias?: string): string {
  if (req.query?.includeDeleted === 'true') return '';
  return `${alias ? `${alias}.` : ''}deletedAt IS NULL`;
}

// AND the (possibly empty) liveOnly condition into a WHERE clause: '' or ' WHERE <cond>'.
export function whereLive(req: Request, alias?: string): string {
  const cond = liveOnly(req, alias);
  return cond ? ` WHERE ${cond}` : '';
}
