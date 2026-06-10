import Link from "next/link";

export default function UpgradePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 py-4 px-4">
      {/* Header */}
      <div className="text-center space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          Mundial 2026 · Planes
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-white">
          Elige tu nivel de entrada
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Selecciona el modo que quieres jugar. Tu acceso se activa al instante.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
        {/* 1. Pase Quiniela */}
        <div className="rounded-2xl border border-cyan-500/25 bg-slate-900/60 p-6 flex flex-col backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">Pase Quiniela</p>
              <p className="mt-1 text-3xl font-black text-white">$1,000 <span className="text-sm font-medium text-slate-500">MXN</span></p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mb-6 flex-grow">
            Pronostica marcadores y compite en la tabla global de puntos.
          </p>
          <ul className="space-y-3 mb-8">
            {["Predicciones de marcador exacto", "5/3/2/1 pts según precisión del pronóstico", "Clasificación en la Liga Global", "Historial completo de pronósticos"].map(feature => (
              <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-cyan-400">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/checkout"
            className="mt-auto block w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 py-3 text-center text-sm font-bold text-cyan-400 transition-all hover:bg-cyan-500/20"
          >
            Seleccionar Pase
          </Link>
        </div>

        {/* 2. Pase Survival */}
        <div className="relative rounded-2xl border border-amber-400/35 bg-slate-900/60 p-6 flex flex-col backdrop-blur-xl shadow-lg shadow-amber-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/15 blur-2xl" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">Pase Survival</p>
              <p className="mt-1 text-3xl font-black text-white">$1,000 <span className="text-sm font-medium text-slate-500">MXN</span></p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mb-6 flex-grow">
            Elige un equipo ganador por jornada. Un fallo y quedas eliminado.
          </p>
          <ul className="space-y-3 mb-8">
            {["1 pick por jornada — sin repetir equipo", "Eliminación al primer fallo", "Tabla de supervivientes en vivo", "El último en pie gana el pozo"].map(feature => (
              <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-amber-400">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/checkout"
            className="mt-auto block w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 py-3 text-center text-sm font-black text-slate-900 shadow-lg shadow-amber-400/25 transition-all hover:from-amber-300 hover:to-yellow-300"
          >
            Seleccionar Pase
          </Link>
        </div>

        {/* 3. Vida Extra */}
        <div className="rounded-2xl border border-emerald-500/25 bg-slate-900/60 p-6 flex flex-col backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Vida Extra</p>
              <p className="mt-1 text-3xl font-black text-white">$1,000 <span className="text-sm font-medium text-slate-500">MXN</span></p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mb-6 flex-grow">
            Incluye solo una vida extra para el juego Survival.<br/><br/><span className="text-emerald-400/80 text-xs font-semibold">Nota: Límite estricto de 1 sola vida extra por usuario.</span>
          </p>
          <ul className="space-y-3 mb-8">
            {["Una vida extra en Survival 🎯"].map(feature => (
              <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-emerald-400">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/checkout"
            className="mt-auto block w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-center text-sm font-bold text-emerald-400 transition-all hover:bg-emerald-500/20"
          >
            Comprar Vida Extra
          </Link>
        </div>
      </div>

      {/* Back */}
      <p className="text-center text-xs text-slate-600 pt-4">
        <Link href="/dashboard" className="hover:text-slate-400 transition-colors">
          ← Volver al Dashboard
        </Link>
      </p>
    </div>
  );
}