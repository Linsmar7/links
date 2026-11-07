import { createCookieSessionStorage, redirect } from 'react-router';

const sessionSecret =
  process.env.SESSION_SECRET || 'dev-fallback-secret-please-set-session-secret';

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__links_admin_session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

// Simple in-memory brute force protection for admin login
interface AttemptRecord {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, AttemptRecord>();

export function checkLoginRateLimit(ip: string): { allowed: boolean; remainingMinutes?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    return { allowed: true };
  }

  if (record.count >= 5) {
    const remainingMinutes = Math.ceil((record.resetAt - now) / 60000);
    return { allowed: false, remainingMinutes };
  }

  return { allowed: true };
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    record.count += 1;
  }
}

export function resetLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get('Cookie'));
}

export async function isAdmin(request: Request): Promise<boolean> {
  const session = await getSession(request);
  return session.get('isAdmin') === true;
}

export async function requireAdmin(request: Request): Promise<void> {
  const admin = await isAdmin(request);
  if (!admin) {
    throw redirect('/entrar');
  }
}

export async function createAdminSession(redirectTo: string = '/') {
  const session = await sessionStorage.getSession();
  session.set('isAdmin', true);
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.commitSession(session),
    },
  });
}

export async function destroySession(request: Request, redirectTo: string = '/') {
  const session = await getSession(request);
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.destroySession(session),
    },
  });
}
