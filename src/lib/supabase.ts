/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

/**
 * Build a Supabase client that mints its access token from Clerk on every request.
 * Supabase's Third-Party Auth integration validates Clerk's JWT via the JWKS URL
 * registered in the Supabase dashboard.
 *
 * Pass a `getToken` function that resolves the current Clerk session token (or null
 * when signed out). The returned client will attach it as `Authorization: Bearer ...`
 * automatically.
 */
export function createSupabaseClient(
  getToken: () => Promise<string | null>
): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    accessToken: async () => (await getToken()) ?? '',
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
