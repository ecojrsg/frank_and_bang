"use client";

// @Author: Jonathan Serna
// @Date:   2026-11-23 21:03:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:03:00

/**
 * Unified Login and Registration page backed by Supabase Auth.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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
    <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-10">
      <div className="grid w-full gap-8 md:grid-cols-2 md:items-center">
        <section className="space-y-4">
          <span className="inline-block rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold tracking-widest text-emerald-300">
            PROYECTO FRANKENTILLERIA · MVP
          </span>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Frank <span className="text-emerald-400">&amp;</span> Bang
          </h1>
          <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
            Abre sobres coleccionables estilo TCG, ensambla tu criatura en el
            Laboratorio de Victor con cabezas, torsos, brazos y piernas unicas,
            y reta a tus amigos en artilleria 2D por turnos con codigo de sala.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-lg font-black text-emerald-300">3</div>
              <div className="text-slate-400">Sobres gratis al crear cuenta</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-lg font-black text-sky-300">4 Slots</div>
              <div className="text-slate-400">Cabeza, torso, brazos y piernas</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-lg font-black text-amber-300">1 vs 1</div>
              <div className="text-slate-400">Host autoritativo por codigo</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-950 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMessage(null);
              }}
              className={`rounded-lg py-2 transition ${
                mode === "login"
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Iniciar Sesion
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setErrorMessage(null);
              }}
              className={`rounded-lg py-2 transition ${
                mode === "register"
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Correo electronico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@correo.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Contrasena
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 6 caracteres"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {errorMessage}
              </div>
            )}

            {infoMessage && (
              <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                {infoMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {submitting
                ? "Conectando..."
                : mode === "login"
                  ? "Entrar al Laboratorio"
                  : "Registrarme y Recibir 3 Sobres"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
