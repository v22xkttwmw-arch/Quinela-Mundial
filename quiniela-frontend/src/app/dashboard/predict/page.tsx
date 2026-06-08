"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { PredictorFluido, type ClassicPredictionData } from "@/components/dashboard/PredictorFluido";

function ClassicPaywall() {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 rounded-2xl px-8 py-16 text-center",
        "border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl"
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
        <span className="text-3xl">🏆</span>
      </div>
      <div>
        <p className="text-base font-bold text-white">Modo Clásico no activado</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          Adquiere tu pase para hacer predicciones de marcador, simular grupos y
          desbloquear el bracket eliminatorio.
        </p>
      </div>
      <Link
        href="/dashboard/checkout"
        className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-500 hover:to-blue-400"
      >
        Ver pases disponibles
      </Link>
    </div>
  );
}

export default function PredictPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [hasPaidClassic, setHasPaidClassic] = useState(false);
  const [savedData, setSavedData] = useState<ClassicPredictionData | null>(null);

  useEffect(() => {
    api.get("/users/me")
      .then((res) => {
        const paid: boolean = res.data.has_paid_classic;
        setHasPaidClassic(paid);
        if (!paid) return;
        // Pre-fetch saved prediction so PredictorFluido doesn't need its own fetch
        return api.get<ClassicPredictionData>("/predictions/classic")
          .then((r) => setSavedData(r.data))
          .catch(() => {}); // 404 = no prediction yet — start fresh
      })
      .catch(() => router.push("/login"))
      .finally(() => setIsLoading(false));
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
      </div>
    );
  }

  if (!hasPaidClassic) return <ClassicPaywall />;

  // Pass savedData (may be null if first-time user) — PredictorFluido handles both cases
  return <PredictorFluido initialData={savedData ?? undefined} />;
}
