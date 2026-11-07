import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, redirect, useActionData, useNavigation } from 'react-router';
import {
  isAdmin,
  createAdminSession,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
} from '~/lib/session.server';

export async function loader({ request }: LoaderFunctionArgs) {
  if (await isAdmin(request)) {
    return redirect('/');
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const rateLimit = checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return {
      error: `Muitas tentativas. Tente novamente em ${rateLimit.remainingMinutes} min.`,
    };
  }

  const formData = await request.formData();
  const password = formData.get('password')?.toString() || '';
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';

  if (!password || password !== expectedPassword) {
    recordFailedLogin(ip);
    return { error: 'Senha incorreta.' };
  }

  resetLoginAttempts(ip);
  return createAdminSession('/');
}

export default function EntrarPage() {
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xs space-y-4">
        <h1 className="text-sm font-mono tracking-wider text-neutral-400 text-center">
          admin
        </h1>

        <Form method="post" className="space-y-3">
          <div>
            <input
              type="password"
              name="password"
              required
              autoFocus
              placeholder="senha"
              className="w-full px-3 py-2 text-sm bg-neutral-900 border border-neutral-800 rounded text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
            />
          </div>

          {actionData?.error && (
            <p className="text-xs text-red-400 font-mono text-center">
              {actionData.error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 text-xs font-mono bg-neutral-200 text-neutral-950 font-medium rounded hover:bg-white transition-colors disabled:opacity-50"
          >
            {isSubmitting ? '...' : 'entrar'}
          </button>
        </Form>
      </div>
    </main>
  );
}
