import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Locale } from '$lib/paraglide/runtime';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
      session: Session | null;
      user: User | null;
      locale: Locale;
    }
    interface PageData {
      session: Session | null;
      user: User | null;
      locale: Locale;
    }
    // interface Error {}
    // interface Platform {}
  }
}

export {};
