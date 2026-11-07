import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { destroySession } from '~/lib/session.server';

export async function loader({ request }: LoaderFunctionArgs) {
  return destroySession(request, '/');
}

export async function action({ request }: ActionFunctionArgs) {
  return destroySession(request, '/');
}
