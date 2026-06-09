"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "smr_onboarding_v1";

/* ─── Step content ─── */
const STEPS = [
  {
    id: "welcome",
    eyebrow: "Bienvenido",
    title: "La Quiniela del\nMundial 2026",
    body: "Compite contra otros participantes pronosticando marcadores de los partidos del Mundial. Cuanto más aciertes, más alto subes en la tabla. Hay dos modalidades: Clásico y Supervivencia.",
    visual: (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <span className="text-5xl font-black tracking-tighter text-white">SMR</span>
          <div className="h-10 w-px bg-slate-700" />
          <div className="text-left">
            <p className="text-xs font-bold text-slate-400">Quinielas</p>
            <p className="text-sm font-extrabold text-blue-400">2026</p>
          </div>
        </div>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.3em] text-slate-600">
          Mundial · Liga Global
        </p>
      </div>
    ),
  },
  {
    id: "clasico",
    eyebrow: "Modo Clásico",
    title: "Entre más preciso,\nmás puntos",
    body: "Antes de cada partido escribe tu marcador previsto. Hay 5 niveles de acierto — entre más cerca estés del resultado real, más puntos sumas en la Liga Global.",
    visual: (
      <div className="flex flex-col gap-2 w-full max-w-[280px]">
        {[
          {
            bg: "bg-emerald-500/15",
            border: "border-emerald-500/30",
            dot: "bg-emerald-500",
            pts: "5 pts",
            ptsColor: "text-emerald-400",
            label: "Marcador Exacto",
            desc: "Acertaste goles local y visitante",
            example: "2 — 1  →  2 — 1",
          },
          {
            bg: "bg-cyan-500/10",
            border: "border-cyan-500/25",
            dot: "bg-cyan-400",
            pts: "3 pts",
            ptsColor: "text-cyan-300",
            label: "Ganador + Gol Exacto",
            desc: "Acertaste ganador y los goles de un equipo",
            example: "3 — 0  →  3 — 1",
          },
          {
            bg: "bg-blue-500/10",
            border: "border-blue-500/25",
            dot: "bg-blue-400",
            pts: "2 pts",
            ptsColor: "text-blue-300",
            label: "Ganador + Diferencia",
            desc: "Acertaste ganador y la diferencia de gol",
            example: "2 — 1  →  3 — 2",
          },
          {
            bg: "bg-amber-400/10",
            border: "border-amber-400/25",
            dot: "bg-amber-400",
            pts: "1 pt",
            ptsColor: "text-amber-300",
            label: "Tendencia Correcta",
            desc: "Acertaste quién gana o empate",
            example: "1 — 0  →  3 — 1",
          },
          {
            bg: "bg-red-500/10",
            border: "border-red-500/25",
            dot: "bg-red-500",
            pts: "0 pts",
            ptsColor: "text-red-400",
            label: "Fallo",
            desc: "Fallaste ganador o empate",
            example: "1 — 2  →  2 — 0",
          },
        ].map((r) => (
          <div
            key={r.label}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-1.5",
              r.bg,
              r.border
            )}
          >
            <span className={cn("h-2.5 w-2.5 flex-shrink-0 rounded-full", r.dot)} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-200">{r.label}</p>
              <p className="text-[10px] text-slate-500">{r.desc} · <span className="font-mono text-slate-600">{r.example}</span></p>
            </div>
            <span className={cn("flex-shrink-0 text-sm font-extrabold tabular-nums", r.ptsColor)}>
              {r.pts}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "supervivencia",
    eyebrow: "Modo Supervivencia",
    title: "Un equipo.\nUna oportunidad.",
    body: "Cada jornada eliges un equipo que crees que va a ganar. Si empata o pierde, quedas eliminado. Además, no puedes elegir el mismo equipo dos veces. ¿Cuánto aguantas?",
    visual: (
      <div className="flex flex-col gap-3 w-full max-w-[280px]">
        {[
          {
            icon: "✅",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/25",
            title: "Tu equipo gana",
            desc: "Sigues en el torneo. Elige otro equipo la próxima jornada.",
          },
          {
            icon: "🚫",
            bg: "bg-slate-800/60",
            border: "border-slate-700/50",
            title: "No puedes repetir",
            desc: "Cada equipo solo se puede usar una vez en todo el torneo.",
          },
          {
            icon: "💀",
            bg: "bg-red-500/10",
            border: "border-red-500/25",
            title: "Tu equipo empata o pierde",
            desc: "Quedas eliminado. Sin segundas oportunidades.",
          },
        ].map((r) => (
          <div
            key={r.title}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-3 py-2.5",
              r.bg,
              r.border
            )}
          >
            <span className="text-lg flex-shrink-0">{r.icon}</span>
            <div>
              <p className="text-xs font-bold text-slate-200">{r.title}</p>
              <p className="text-[10px] leading-relaxed text-slate-500">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
] as const;

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else dismiss();
  }

  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(2, 6, 23, 0.85)", backdropFilter: "blur(12px)" }}
    >
      {/* Modal card */}
      <div
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl",
          "bg-slate-900/90 border border-slate-700/60 backdrop-blur-2xl",
          "flex flex-col"
        )}
        style={{ boxShadow: "0 0 80px rgba(59,130,246,0.08), 0 25px 50px rgba(0,0,0,0.6)" }}
      >
        {/* Top gradient bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500/60 via-blue-500/60 to-indigo-500/60" />

        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />

        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-800/80 text-slate-500 transition-all hover:bg-slate-700 hover:text-white"
          aria-label="Cerrar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        {/* Body */}
        <div className="flex flex-col items-center gap-6 px-8 pb-8 pt-10">
          {/* Eyebrow */}
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
            {current.eyebrow}
          </p>

          {/* Title */}
          <h2 className="text-center text-2xl font-extrabold leading-tight tracking-tight text-white whitespace-pre-line">
            {current.title}
          </h2>

          {/* Visual */}
          <div className="flex w-full justify-center">
            {current.visual}
          </div>

          {/* Body text */}
          <p className="text-center text-sm leading-relaxed text-slate-400">
            {current.body}
          </p>

          {/* Step dots */}
          <div className="flex gap-2">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === step
                    ? "w-6 bg-blue-500"
                    : "w-1.5 bg-slate-700 hover:bg-slate-600"
                )}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex w-full gap-3">
            {step > 0 && (
              <button
                onClick={prev}
                className="flex-1 rounded-xl border border-slate-700/60 bg-slate-800/60 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:border-slate-500/60 hover:text-white"
              >
                Anterior
              </button>
            )}
            <button
              onClick={next}
              className={cn(
                "rounded-xl py-2.5 text-sm font-bold text-white transition-all",
                "bg-gradient-to-r from-emerald-500 to-blue-600 shadow-lg shadow-emerald-500/20",
                "hover:from-emerald-400 hover:to-blue-500 hover:shadow-emerald-500/30",
                step > 0 ? "flex-1" : "w-full"
              )}
            >
              {isLast ? "¡Entendido, a jugar!" : "Siguiente →"}
            </button>
          </div>

          {/* Skip link */}
          {!isLast && (
            <button
              onClick={dismiss}
              className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              Saltar tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
