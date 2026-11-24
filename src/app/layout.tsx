// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:32:00

/**
 * Root Next.js App Router layout for Frank and Bang with industrial display,
 * clean sans, and monospace telemetry typography.
 */

import type { Metadata } from "next";
import { Barlow, Chakra_Petch, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
});

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
    <html
      lang="es"
      className={`${chakraPetch.variable} ${barlow.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-[#141418] text-[#ECEAE4] antialiased">
        {children}
      </body>
    </html>
  );
}
