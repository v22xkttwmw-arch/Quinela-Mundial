import Link from "next/link";

const FEATURES = [
  { icon: "🏆", title: "Simulador Premium",     desc: "Simula el torneo completo con 72 partidos de grupo, bracket eliminatorio y predicción del campeón.", plan: "classic" },
  { icon: "📊", title: "Motor de Puntuación",   desc: "Multiplicadores por fase (×1 a ×4), bono de campeón (+20 pts) y Botón Capitán para doblar puntos.", plan: "classic" },
  { icon: "⚡", title: "Mi Rendimiento",         desc: "Dashboard con KPIs en tiempo real, efectividad, historial de predicciones y posición global.", plan: "classic" },
  { icon: "💀", title: "Modo Supervivencia",    desc: "Elige un equipo ganador por jornada. Si empata o pierde, quedas eliminado. El último en pie lleva el pozo.", plan: "vip" },
  { icon: "🎯", title: "Botón Capitán",          desc: "Designa hasta 5 partidos donde tus puntos se multiplican ×2. Úsalo estratégicamente.", plan: "vip" },
  { icon: "💰", title: "Pozo Acumulado VIP",    desc: "Acceso al 90 % del pozo de Supervivencia + 60 % del primer lugar en el Modo Clásico.", plan: "vip" },
];

export default function UpgradePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      {/* Header */}
      <div className="text-center space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          Mundial 2026 · Planes
        </p>
        <h1 className="text-3xl font-black text-white">
          Desbloquea el{" "}
          <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
            Pase VIP
          </span>
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Accede a los dos modos de juego simultáneos, el motor de puntuación completo y la distribución de premios del torneo.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Classic */}
        <div className="rounded-2xl border border-cyan-500/25 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-400">Pase Clásico</p>
              <p className="mt-0.5 text-2xl font-black text-white">$2,500 MXN</p>
            </div>
            <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-cyan-400">
              Classic
            </span>
          </div>
          <ul className="space-y-1.5 mb-5">
            {FEATURES.filter(f => f.plan === "classic").map(f => (
              <li key={f.title} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="shrink-0">{f.icon}</span>
                <span><span className="font-semibold text-white">{f.title}</span> — {f.desc}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/checkout"
            className="block w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 py-2.5 text-center text-sm font-bold text-cyan-400 transition-all hover:bg-cyan-500/20"
          >
            Ver Pase Clásico
          </Link>
        </div>

        {/* VIP */}
        <div className="relative rounded-2xl border border-amber-400/35 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/15 blur-2xl" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-400">Pase VIP</p>
              <p className="mt-0.5 text-2xl font-black text-white">$5,000 MXN</p>
            </div>
            <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-amber-300">
              VIP
            </span>
          </div>
          <p className="mb-3 text-[10px] text-slate-500">Todo lo del Clásico, más:</p>
          <ul className="space-y-1.5 mb-5">
            {FEATURES.filter(f => f.plan === "vip").map(f => (
              <li key={f.title} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="shrink-0">{f.icon}</span>
                <span><span className="font-semibold text-white">{f.title}</span> — {f.desc}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/checkout"
            className="block w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 py-2.5 text-center text-sm font-black text-slate-900 shadow-lg shadow-amber-400/25 transition-all hover:from-amber-300 hover:to-yellow-300"
          >
            Obtener Pase VIP →
          </Link>
        </div>
      </div>

      {/* Back */}
      <p className="text-center text-xs text-slate-600">
        <Link href="/dashboard" className="hover:text-slate-400 transition-colors">
          ← Volver al Dashboard
        </Link>
      </p>
    </div>
  );
}
