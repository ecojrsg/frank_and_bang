// @Author: Jonathan Serna
// @Date:   2026-11-23 21:00:30
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:00:30

/**
 * Shared Supabase environment helpers and public Storage asset constants.
 */

import { buildStoragePublicUrl } from "@/domain/partMapper";

export const CARD_BACK_ASSET_PATH = "cards/card_back.svg";

/**
 * Read public Supabase URL and publishable/anon key from environment variables.
 *
 * @throws {Error} When required public Supabase variables are missing.
 */
export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return { url, anonKey };
}

/**
 * Return the public Storage URL for the TCG card back inside parts-assets.
 */
export function getCardBackPublicUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return buildStoragePublicUrl(url, CARD_BACK_ASSET_PATH);
}
