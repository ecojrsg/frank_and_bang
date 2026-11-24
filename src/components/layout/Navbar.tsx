"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:36:00

/**
 * Persistent top command bar styled as a sharp charcoal-graphite, copper, and
 * radioactive bio-green technical strip displaying route links, packs, and FC.
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
 * Render the authenticated technical command navigation header for Frank and Bang.
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
    <header className="sticky top-0 z-30 bg-[#15151A]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/menu"
            className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-[#ECEAE4]"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center border border-[#D47E3F] bg-[#1B1C22] font-mono text-xs font-bold text-[#52FF2E]">
              FB
            </span>
            <span>Frank &amp; Bang</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`border-b-2 px-3 py-1.5 font-mono text-xs font-bold tracking-wider uppercase transition ${
                    active
                      ? "border-[#52FF2E] bg-[#1B1C22] text-[#52FF2E]"
                      : "border-transparent text-[#B0AEA6] hover:border-[#D47E3F]/60 hover:text-[#ECEAE4]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
          <span className="border-r border-[#2E313D] pr-3 text-[#52FF2E]">
            SOBRES: {freePacks}
          </span>
          <span className="border-r border-[#2E313D] pr-3 text-[#EB9C5C]">
            {coins} FC
          </span>
          <span className="hidden text-[#B0AEA6] sm:inline">{displayName}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="border border-[#3A3D4A] bg-[#1B1C22] px-2.5 py-1 text-[11px] font-bold tracking-wider text-[#B0AEA6] uppercase transition hover:border-[#E84A5F] hover:text-[#E84A5F]"
          >
            Salir
          </button>
        </div>
      </div>
      <div className="sheet-rule-h" />
    </header>
  );
}
