"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Llamada a tu backend en FastAPI
      await api.post("/users/", { email, password });
      
      toast.success("¡Cuenta creada exitosamente! Ya puedes iniciar sesión.");
      
      // Redirigimos al usuario al login para que ingrese sus credenciales
      router.push("/login");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Error al registrar. Intenta de nuevo.";
      toast.error(message);
      setIsLoading(false); // Solo apagamos el loading si falla
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4">
      
      {/* ── Ambient Background Glows ── */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-fuchsia-600/10 blur-[120px]" />

      <div className="relative w-full max-w-sm z-10">
        
        {/* ── Branding Header ── */}
        <div className="mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-xl backdrop-blur-sm">
            <span className="text-3xl">🏆</span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-[0.1em] text-white">
            Únete a la <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Liga</span>
          </h1>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            SMR Quinielas · Mundial 2026
          </p>
        </div>

        {/* ── Register Card ── */}
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
                  Contraseña Segura
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
                    : "bg-gradient-to-r from-cyan-500 to-fuchsia-600 shadow-cyan-500/25 hover:from-cyan-400 hover:to-fuchsia-500"
                )}
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                    Registrando...
                  </>
                ) : (
                  "Crear mi cuenta VIP"
                )}
              </button>
            </form>
          </div>

          {/* ── Footer ── */}
          <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-4 text-center">
            <p className="text-[11px] font-medium text-slate-500">
              ¿Ya tienes una cuenta?{" "}
              <Link href="/login" className="font-bold text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}