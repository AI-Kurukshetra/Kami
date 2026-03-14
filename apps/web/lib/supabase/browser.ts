import { createClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createClient> | null = null;

function readConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function tryCreateSupabaseBrowserClient() {
  if (client) {
    return client;
  }

  const config = readConfig();

  if (!config) {
    return null;
  }

  client = createClient(config.url, config.anonKey);
  return client;
}

export function createSupabaseBrowserClient() {
  const instance = tryCreateSupabaseBrowserClient();

  if (!instance) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return instance;
}
