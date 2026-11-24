// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:03:00

/**
 * Root Next.js App Router layout for Frank and Bang.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Frank and Bang — Laboratorio Gacha y Artilleria 2D",
  description:
    "Ensambla tu criatura Frankenstein con cartas coleccionables y combate por turnos en 2D.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased selection:bg-emerald-400/30 selection:text-emerald-100">
        {children}
      </body>
    </html>
  );
}
