"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { flagUrl } from "@/lib/flags";
import { PredictorFluido, type ClassicPredictionData } from "@/components/dashboard/PredictorFluido";

interface GuestMatch {
  id: number;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  round?: string | null;
  group_name?: string | null;
}

const GUEST_GLASS = "border border-slate-700/50 bg-slate-900/50 backdrop-blur-xl";

function GuestClassicPreview({ matches }: { matches: GuestMatch[] }) {
  const router = useRouter();
  const groupMatches = matches.filter((m) => m.round?.startsWith("Group Stage"));

  return (
    <div className="space-y-4">
      <div className={cn("rounded-2xl px-5 py-4 text-center", GUEST_GLASS)}>
        <p className="text-sm font-bold text-white">Modo Clásico — Vista previa</p>
        <p className="mt-1 text-xs text-slate-400">
          Crea tu cuenta para predecir el marcador de cada partido y competir en la Liga Global.
        </p>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {groupMatches.map((m) => {
          const fmt = new Date(
            m.kickoff_time.endsWith("Z") ? m.kickoff_time : m.kickoff_time + "Z"
          ).toLocaleString("es-MX", {
            weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          });
          return (
            <div
              key={m.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push("/register")}
              className={cn("cursor-pointer rounded-2xl px-4 py-3 transition-all hover:border-slate-500/50", GUEST_GLASS)}
            >
              <p className="text-[9px] font-medium text-slate-500">{fmt}{m.group_name ? ` · Grupo ${m.group_name}` : ""}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <TeamPreview team={m.home_team} />
                <div className="flex shrink-0 items-center gap-1.5">
                  <ScoreSlot />
                  <span className="text-xs font-black text-slate-700">—</span>
                  <ScoreSlot />
                </div>
                <TeamPreview team={m.away_team} align="right" />
              </div>
            </div>
          );
        })}
        {groupMatches.length === 0 && (
          <div className={cn("rounded-2xl py-12 text-center text-sm text-slate-500 sm:col-span-2", GUEST_GLASS)}>
            Partidos por confirmar.
          </div>
        )}
      </div>
    </div>
  );
}

function TeamPreview({ team, align = "left" }: { team: string; align?: "left" | "right" }) {
  const url = flagUrl(team, 40);
  return (
    <div className={cn("flex min-w-0 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      {url ? (
        <img src={url} alt={team} className="h-7 w-10 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-7 w-10 shrink-0 items-center justify-center rounded-md bg-slate-700/60 text-[9px] font-bold text-slate-400">
          {team.slice(0, 3).toUpperCase()}
        </div>
      )}
      <span className="truncate text-xs font-semibold text-slate-300">{team}</span>
    </div>
  );
}

function ScoreSlot() {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/40 text-xs font-bold text-slate-700">
      –
    </div>
  );
}

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
  const [isGuest, setIsGuest] = useState(false);
  const [guestMatches, setGuestMatches] = useState<GuestMatch[]>([]);

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
      .catch((err) => {
        if (err?.response?.status === 401) {
          setIsGuest(true);
          return api.get<GuestMatch[]>("/matches/all")
            .then((r) => setGuestMatches(r.data ?? []))
            .catch(() => {});
        }
        router.push("/login");
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
      </div>
    );
  }

  if (isGuest) return <GuestClassicPreview matches={guestMatches} />;

  if (!hasPaidClassic) return <ClassicPaywall />;

  // Pass savedData (may be null if first-time user) — PredictorFluido handles both cases
  return <PredictorFluido initialData={savedData ?? undefined} />;
}
