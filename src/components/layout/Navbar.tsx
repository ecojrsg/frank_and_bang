"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:03:00

/**
 * Persistent top navigation bar displaying active route, FrankenCoins,
 * available free Gacha packs, and sign-out action.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/infrastructure/supabase/client";

interface NavbarProps {
  displayName: string;
  coins: number;
  freePacks: number;
}

const NAV_LINKS = [
  { href: "/menu", label: "Menu y Salas" },
  { href: "/gacha", label: "Sobres TCG" },
  { href: "/lab", label: "Laboratorio" },
];

/**
 * Render the authenticated navigation header for Frank and Bang.
 */
export function Navbar({ displayName, coins, freePacks }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-5">
          <Link
            href="/menu"
            className="flex items-center gap-2 font-black tracking-tight text-emerald-300"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/50 bg-emerald-500/15 text-sm">
              FB
            </span>
            <span className="text-lg">Frank &amp; Bang</span>
          </Link>

          <nav className="flex items-center gap-1.5">
            {NAV_LINKS.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5 text-xs sm:text-sm">
          <span className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 font-semibold text-sky-200">
            Sobres: {freePacks}
          </span>
          <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 font-semibold text-amber-200">
            {coins} FC
          </span>
          <span className="hidden text-slate-300 sm:inline">{displayName}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-rose-400/60 hover:text-rose-200"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
