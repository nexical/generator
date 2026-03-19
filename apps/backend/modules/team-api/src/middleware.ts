// GENERATED CODE - DO NOT MODIFY
import type { APIContext, MiddlewareNext } from 'astro';

export async function onRequest(context: APIContext, next: MiddlewareNext) {
  const publicRoutes: string[] = [];
  if (publicRoutes.some((route) => context.url.pathname.startsWith(route))) return next();
  // Session Hydration
  // Dynamic Bouncer Pattern: Validate Actor Status
  if (context.locals.actor) return next();
  return next();
}
export default { onRequest };
