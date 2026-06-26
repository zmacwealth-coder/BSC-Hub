import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error(
      'CRITICAL: Supabase environment variables are missing in the browser client! ' +
      'Ensure .env.local contains NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, ' +
      'and that you have completely restarted your dev server (npm run dev).'
    );
  }

  return createBrowserClient(url!, anonKey!);
}

