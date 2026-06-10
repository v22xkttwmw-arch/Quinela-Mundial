"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { AuthShowcase } from "@/components/auth/AuthShowcase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const body = new URLSearchParams();
      body.append("username", email); // FastAPI espera "username", aunque mandemos el email
      body.append("password", password);

      const res = await api.post("/login", body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      // El backend establece la cookie HttpOnly — pero iOS Safari (ITP)
      // bloquea cookies cross-site incluso con SameSite=None; Secure.
      // Guardamos el token también en localStorage como fallback.
      if (res.data?.access_token) {
        window.localStorage.setItem("token", res.data.access_token);
      }

      toast.success("¡Bienvenido de vuelta a la Liga!");

      // window.location.href garantiza navegación completa y limpia el caché
      // de módulo de useUser — router.push falla silenciosamente en contexto
      // cross-origin con páginas estáticas en Next.js 16.
      window.location.href = "/dashboard/rendimiento";
      
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Credenciales incorrectas. Intenta de nuevo.";
      toast.error(message);
      setIsLoading(false); // Solo apagamos el loading si hay error
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">

      {/* ── Ambient Background Glows ── */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-fuchsia-600/10 blur-[120px]" />

      <div className="relative z-10 grid w-full max-w-5xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">

        {/* ── Presentación del Sistema ── */}
        <AuthShowcase />

        <div className="w-full max-w-sm mx-auto lg:mx-0">

          {/* ─── ENCABEZADO DEL LOGIN ─── */}
          <div className="flex flex-col items-center gap-4 text-center mb-6">
            {/* Logo Oficial del Mundial */}
            <Image
              src="/logo-mundial.png"
              alt="Logo Mundial 2026"
              width={64}
              height={64}
              priority
              className="h-16 w-16 object-contain"
            />

            {/* Texto Oficial */}
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-widest text-white uppercase">
                MUNDIAL <span className="text-cyan-400">2026</span>
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                Acceso VIP · Liga Global
              </p>
            </div>
          </div>

          {/* ── Login Card ── */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150">
            <div className="px-6 py-8">
              <form onSubmit={handleSubmit} className="space-y-5">

                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Correo Electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    "mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-[0.98]",
                    isLoading
                      ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-cyan-500 to-blue-600 shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500"
                  )}
                >
                  {isLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                      Autenticando...
                    </>
                  ) : (
                    "Ingresar a mi Dashboard"
                  )}
                </button>
              </form>
            </div>

            {/* ── Footer ── */}
            <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-4 text-center">
              <p className="text-[11px] font-medium text-slate-500">
                ¿Aún no eres parte de la liga?{" "}
                <Link href="/register" className="font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
                  Crear cuenta
                </Link>
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}