import { describe, expect, it, vi } from 'vitest';
import { requireRoles } from './role-middleware.js';

describe('requireRoles', () => {
  it('allows request when role is authorized', () => {
    const next = vi.fn();
    const middleware = requireRoles(['admin']);
    const req = { user: { role: 'admin' } } as never;

    middleware(req, {} as never, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks request when role is not authorized', () => {
    const next = vi.fn();
    const middleware = requireRoles(['admin']);
    const req = { user: { role: 'viewer' } } as never;

    middleware(req, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]?.statusCode).toBe(403);
  });
});
