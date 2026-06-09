"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Plan = "classic" | "survival" | "complete";

interface PlanCard {
  id: Plan;
  name: string;
  price: string;
  description: string;
  features: string[];
  badge?: string;
  gradient: string;
  ring: string;
}

const PLANS: PlanCard[] = [
  {
    id: "classic",
    name: "La Quiniela",
    price: "$1,500",
    description: "Pronostica marcadores y compite en la tabla global de puntos.",
    features: [
      "Predicciones de marcador exacto",
      "3 pts por exacto · 1 pt por tendencia",
      "Clasificación en la Liga Global",
      "Historial completo de pronósticos",
    ],
    gradient: "from-blue-600/20 to-slate-900",
    ring: "ring-blue-500/40",
  },
  {
    id: "survival",
    name: "Supervivencia",
    price: "$1,500",
    description: "Elige un equipo ganador por jornada. Un fallo y quedas eliminado.",
    features: [
      "1 pick por jornada — sin repetir equipo",
      "Eliminación al primer fallo",
      "Tabla de supervivientes en vivo",
      "El último en pie gana el pozo",
    ],
    gradient: "from-amber-600/20 to-slate-900",
    ring: "ring-amber-500/40",
  },
  {
    id: "complete",
    name: "Vida Extra",
    price: "$1,500",
    description: "Una vida adicional en Supervivencia + acceso completo a ambos modos.",
    features: [
      "Todo lo del Modo Clásico",
      "Todo lo del Modo Supervivencia",
      "Una vida extra en Supervivencia 🎯",
      "Soporte prioritario vía WhatsApp",
    ],
    badge: "Mejor opción",
    gradient: "from-emerald-600/25 via-blue-600/15 to-slate-900",
    ring: "ring-emerald-500/50",
  },
];

const WHATSAPP_NUMBER = "5215525624262";

export default function CheckoutPage() {
  const [selected, setSelected] = useState<Plan | null>(null);

  function handleProceed() {
    if (!selected) return;
    const plan = PLANS.find((p) => p.id === selected)!;
    const text = encodeURIComponent(
      `Hola, quiero inscribirme al *${plan.name}* de SMR Quinielas Mundial 2026 (${plan.price} MXN). ¿Cómo procedo con el pago?`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-4">
      {/* Header */}
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-emerald-400">
          Mundial 2026
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-white">
          Elige tu nivel de entrada
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Selecciona el modo que quieres jugar. Tu acceso se activa al instante.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className={cn(
                "relative flex flex-col rounded-2xl border p-6 text-left transition-all duration-300 focus:outline-none",
                "bg-gradient-to-br",
                plan.gradient,
                isSelected
                  ? `border-transparent ring-2 ${plan.ring} shadow-2xl scale-[1.02]`
                  : "border-slate-700/50 hover:border-slate-600/60 hover:scale-[1.01]"
              )}
            >
              {/* Badge */}
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500 to-blue-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-emerald-500/25">
                  {plan.badge}
                </span>
              )}

              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              {/* Plan name */}
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {plan.name}
              </p>

              {/* Price */}
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tabular-nums text-white">
                  {plan.price}
                </span>
                <span className="text-sm text-slate-500">MXN</span>
              </div>

              {/* Description */}
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {plan.description}
              </p>

              {/* Features */}
              <ul className="mt-5 space-y-2">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-[13px] text-slate-300">
                    <span className="mt-0.5 text-emerald-400">✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleProceed}
          disabled={!selected}
          className={cn(
            "w-full max-w-sm rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-300",
            selected
              ? "bg-gradient-to-r from-emerald-500 to-blue-600 shadow-emerald-500/25 hover:from-emerald-400 hover:to-blue-500 hover:shadow-emerald-500/40 hover:scale-[1.01]"
              : "cursor-not-allowed bg-slate-800 text-slate-500"
          )}
        >
          {selected
            ? `Pagar por WhatsApp — ${PLANS.find((p) => p.id === selected)?.price} MXN`
            : "Selecciona un plan para continuar"}
        </button>

        <p className="text-center text-[11px] text-slate-600">
          Te contactamos por WhatsApp para confirmar tu pago · Acceso inmediato
        </p>
      </div>
    </div>
  );
}
