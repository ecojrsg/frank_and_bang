"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 23:34:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:34:00

/**
 * 5-column technical product design sheet with 1px dividing hairlines fading
 * toward #16161B at all 4 outer edges, zero border-radius, and isometric cells.
 */

import Link from "next/link";

import { BlueprintFigureCell } from "./BlueprintFigureCell";

/**
 * Render the interactive 5-column Frank and Bang technical architecture sheet.
 */
export function BlueprintSheetSection() {
  return (
    <section
      aria-label="Hoja tecnica del sistema Frank and Bang"
      className="bg-[#16161B]"
    >
      <div className="sheet-rule-h" />

      <div className="grid grid-cols-1 lg:grid-cols-5">
        {/* Row 1, Cols 1-2: Specification Cell */}
        <div className="sheet-cell-edge-b sheet-cell-edge-r flex flex-col justify-between bg-[#16161B] p-6 sm:p-8 lg:col-span-2">
          <div>
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-[#ECEAE4] sm:text-4xl">
              Sistema diseñado como plano técnico.
            </h2>
            <p className="mt-4 max-w-[38ch] font-mono text-xs leading-relaxed text-[#B0AEA6]">
              Cada pieza anatómica, línea divisoria de 1px y nodo de combate
              responde a reglas exactas en Supabase para ensamblar tu criatura
              sin fricción.
            </p>
          </div>

          <div className="mt-8">
            <Link
              href="/lab"
              className="inline-flex items-center gap-2 font-mono text-xs font-bold tracking-wider text-[#52FF2E] transition hover:text-[#ECEAE4]"
            >
              Explorar laboratorio <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>

        {/* Row 1, Cols 3-5: FIG_01 Solid Isometric Bio-Assembly */}
        <div className="sheet-cell-edge-b lg:col-span-3">
          <BlueprintFigureCell
            fig="FIG_01"
            hint="HOVER / CLIC PARA SEPARAR CAPAS"
            readout="Z-CAL · 4 SLOTS"
            accent="green"
            className="h-full"
          />
        </div>

        {/* Row 2, Cols 1-3: FIG_02 Vernier Ballistic Mechanism */}
        <div className="sheet-cell-edge-b sheet-cell-edge-r lg:col-span-3">
          <BlueprintFigureCell
            fig="FIG_02"
            hint="VERNIER PARABOLICO EN VIVO"
            readout="GRAVEDAD · 520 PX/S2"
            accent="copper"
            className="h-full"
          />
        </div>

        {/* Row 2, Cols 4-5: Ballistics & Terrain Spec */}
        <div className="sheet-cell-edge-b flex flex-col justify-between bg-[#16161B] p-6 sm:p-8 lg:col-span-2">
          <div>
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-[#ECEAE4] sm:text-3xl">
              Balística y cráteres destructibles
            </h2>
            <p className="mt-4 max-w-[38ch] font-mono text-xs leading-relaxed text-[#B0AEA6]">
              Trayectorias parabólicas con excavación en tiempo real sobre mapas
              aleatorios de hasta 4200px para combates tácticos 1v1 y 2v2 por
              turnos.
            </p>
          </div>

          <div className="mt-8 flex items-center justify-between font-mono text-[11px] text-[#D47E3F]">
            <span>FÓRMULA DIRECTA</span>
            <span className="tabular-nums text-[#ECEAE4]">max(1, ATK - DEF)</span>
          </div>
        </div>

        {/* Row 3, Cols 1-2: FIG_03 Gacha Specimen Capsule */}
        <div className="sheet-cell-edge-b sheet-cell-edge-r lg:col-span-2">
          <BlueprintFigureCell
            fig="FIG_03"
            hint="CAPSULA ESPECIMENES TCG"
            readout="70% / 24% / 6%"
            accent="green"
            className="h-full"
          />
        </div>

        {/* Row 3, Col 3: Gacha Spec */}
        <div className="sheet-cell-edge-b sheet-cell-edge-r flex flex-col justify-between bg-[#16161B] p-6 sm:p-7 lg:col-span-1">
          <div>
            <h2 className="text-xl font-bold leading-tight text-[#ECEAE4]">
              Sobres TCG
            </h2>
            <p className="mt-3 font-mono text-xs leading-relaxed text-[#B0AEA6]">
              Desgarra cápsulas selladas con piezas Normales, Raras en cobre y
              Únicas radioactivas.
            </p>
          </div>

          <Link
            href="/gacha"
            className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#D47E3F] transition hover:text-[#EB9C5C]"
          >
            Abrir sobres <span aria-hidden="true">↗</span>
          </Link>
        </div>

        {/* Row 3, Cols 4-5: FIG_04 Host-Authoritative Relay */}
        <div className="sheet-cell-edge-b lg:col-span-2">
          <BlueprintFigureCell
            fig="FIG_04"
            hint="RELE HOST-AUTORITATIVO"
            readout="SUPA REALTIME · 30HZ"
            accent="copper"
            className="h-full"
          />
        </div>
      </div>
    </section>
  );
}
