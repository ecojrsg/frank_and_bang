"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 23:36:00

/**
 * Unified Login and Registration blueprint sheet backed by Supabase Auth.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { BlueprintFigureCell } from "@/components/blueprint/BlueprintFigureCell";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/client";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "register") {
        const cleanName = displayName.trim();
        if (cleanName.length < 2) {
          setErrorMessage("Escribe un nombre de jugador de al menos 2 caracteres.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: cleanName },
          },
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        if (!data.session) {
          setInfoMessage(
            "Cuenta creada. Revisa tu correo para confirmar o desactiva Confirm Email en Supabase Auth para acceso inmediato."
          );
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMessage("Correo o contrasena incorrectos.");
          return;
        }
      }

      router.push("/menu");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible conectar con Supabase. Revisa .env.local."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10">
      <div className="w-full bg-[#16161B]">
        <div className="sheet-rule-h" />

        <div className="grid w-full grid-cols-1 lg:grid-cols-5">
          {/* Left 3 cols: Editorial Title + Blueprint Mechanism FIG_01 */}
          <section className="sheet-cell-edge-b sheet-cell-edge-r flex flex-col justify-between bg-[#16161B] lg:col-span-3">
            <div className="p-6 sm:p-8">
              <h1 className="text-4xl font-bold tracking-tight text-[#ECEAE4] sm:text-5xl">
                Frank <span className="text-[#52FF2E]">&amp;</span> Bang
              </h1>
              <p className="mt-4 max-w-[54ch] text-sm leading-relaxed text-[#B0AEA6] sm:text-base">
                Abre cápsulas coleccionables estilo TCG, ensambla tu criatura en
                el Laboratorio de Victor con cabezas, torsos, brazos y piernas
                únicas, y combate en artillería 2D por turnos de 2 a 4 jugadores.
              </p>

              <div className="mt-6 grid grid-cols-3 border-t border-[#2B2D38] pt-5 font-mono text-xs tabular-nums">
                <div className="border-r border-[#2B2D38] pr-3">
                  <div className="text-lg font-bold text-[#52FF2E]">3</div>
                  <div className="text-[#8E8D86]">Sobres al registrarte</div>
                </div>
                <div className="border-r border-[#2B2D38] px-3">
                  <div className="text-lg font-bold text-[#D47E3F]">4 Slots</div>
                  <div className="text-[#8E8D86]">Piezas modulares</div>
                </div>
                <div className="pl-3">
                  <div className="text-lg font-bold text-[#ECEAE4]">1v1 / 2v2</div>
                  <div className="text-[#8E8D86]">Host por código</div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#2B2D38]">
              <BlueprintFigureCell
                fig="FIG_01"
                hint="SISTEMA BIO-INDUSTRIAL · ACTIVO"
                readout="LABORATORIO VICTOR"
                accent="green"
              />
            </div>
          </section>

          {/* Right 2 cols: Auth Form Plate */}
          <section className="sheet-cell-edge-b flex flex-col justify-center bg-[#15151A] p-6 sm:p-8 lg:col-span-2">
            <div className="mb-6 grid grid-cols-2 border border-[#2E313D] bg-[#141418] font-mono text-xs font-bold uppercase">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrorMessage(null);
                }}
                className={`py-2.5 transition ${
                  mode === "login"
                    ? "bg-[#52FF2E] text-[#121216]"
                    : "text-[#8E8D86] hover:text-[#ECEAE4]"
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setErrorMessage(null);
                }}
                className={`py-2.5 transition ${
                  mode === "register"
                    ? "bg-[#D47E3F] text-[#121216]"
                    : "text-[#8E8D86] hover:text-[#ECEAE4]"
                }`}
              >
                Crear Cuenta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="mb-1.5 block font-mono text-xs font-bold tracking-wider text-[#B0AEA6] uppercase">
                    Nombre de jugador
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={24}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ej. DrVictor"
                    className="w-full border border-[#2E313D] bg-[#141418] px-3.5 py-2.5 text-sm text-[#ECEAE4] outline-none focus:border-[#52FF2E]"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block font-mono text-xs font-bold tracking-wider text-[#B0AEA6] uppercase">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@correo.com"
                  className="w-full border border-[#2E313D] bg-[#141418] px-3.5 py-2.5 text-sm text-[#ECEAE4] outline-none focus:border-[#52FF2E]"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-xs font-bold tracking-wider text-[#B0AEA6] uppercase">
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-[#2E313D] bg-[#141418] px-3.5 py-2.5 text-sm text-[#ECEAE4] outline-none focus:border-[#52FF2E]"
                />
              </div>

              {errorMessage && (
                <div className="border border-[#E84A5F]/60 bg-[#E84A5F]/15 px-3 py-2 font-mono text-xs text-[#ECEAE4]">
                  {errorMessage}
                </div>
              )}

              {infoMessage && (
                <div className="border border-[#D47E3F]/60 bg-[#D47E3F]/15 px-3 py-2 font-mono text-xs text-[#ECEAE4]">
                  {infoMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3 font-mono text-xs font-bold tracking-widest text-[#121216] uppercase transition disabled:opacity-60 ${
                  mode === "login"
                    ? "bg-[#52FF2E] hover:bg-[#32C81E]"
                    : "bg-[#D47E3F] hover:bg-[#EB9C5C]"
                }`}
              >
                {submitting
                  ? "Conectando..."
                  : mode === "login"
                    ? "Entrar al Laboratorio"
                    : "Registrarme y Recibir 3 Sobres"}
              </button>
            </form>

            <div className="mt-8 border-t border-[#2B2D38] pt-4 font-mono text-[10px] tracking-widest text-[#8E8D86]">
              FRANKENTILLERIA // SUPABASE AUTH + RLS
            </div>
          </section>
        </div>

        <div className="sheet-rule-h" />
      </div>
    </main>
  );
}
