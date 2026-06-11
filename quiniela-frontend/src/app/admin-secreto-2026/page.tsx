"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface UserAudit {
  id: number;
  name: string;
  email: string;
  has_paid_classic: boolean;
  has_paid_survival: boolean;
  classic_picks_filled: number;
  classic_picks_total: number;
  survival_status: string | null;
  survival_jornada1_pick: string | null;
}

export default function AdminAuditPage() {
  const [users, setUsers] = useState<UserAudit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<UserAudit[]>("/admin/users-audit")
      .then((res) => setUsers(res.data))
      .catch(() => setError("No se pudo cargar la auditoría."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
            Panel Interno · No Indexado
          </p>
          <h1 className="text-2xl font-black text-white">
            Auditoría de Usuarios — Pre-Torneo
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Verifica pagos y picks completos antes de que arranque el Mundial 2026.
          </p>
        </div>

        {isLoading && (
          <p className="text-sm text-slate-500">Cargando usuarios…</p>
        )}

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {!isLoading && !error && (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Pagos</th>
                  <th className="px-4 py-3">Estatus Modo Clásico</th>
                  <th className="px-4 py-3">Estatus Supervivencia</th>
                  <th className="px-4 py-3">Readiness</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <PayBadge label="Clásico" paid={u.has_paid_classic} />
                        <PayBadge label="Survival" paid={u.has_paid_survival} />
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <ClassicStatus
                        paid={u.has_paid_classic}
                        filled={u.classic_picks_filled}
                        total={u.classic_picks_total}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <SurvivalStatus
                        paid={u.has_paid_survival}
                        status={u.survival_status}
                        jornada1={u.survival_jornada1_pick}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <ReadinessBadge user={u} />
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                      No hay usuarios registrados todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function PayBadge({ label, paid }: { label: string; paid: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
        paid
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-slate-700 bg-slate-800/50 text-slate-500"
      )}
    >
      {paid ? "✅" : "—"} {label}
    </span>
  );
}

function ClassicStatus({
  paid,
  filled,
  total,
}: {
  paid: boolean;
  filled: number;
  total: number;
}) {
  if (!paid) {
    return <span className="text-xs text-slate-600">No participa</span>;
  }
  if (total === 0) {
    return <span className="text-xs font-semibold text-red-400">❌ Sin iniciar</span>;
  }
  if (filled === total) {
    return (
      <span className="text-xs font-semibold text-emerald-400">
        ✅ {filled}/{total} Listos
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-amber-400">
      ⚠️ Faltan picks ({filled}/{total})
    </span>
  );
}

function SurvivalStatus({
  paid,
  status,
  jornada1,
}: {
  paid: boolean;
  status: string | null;
  jornada1: string | null;
}) {
  if (!paid) {
    return <span className="text-xs text-slate-600">No participa</span>;
  }
  if (!jornada1) {
    return <span className="text-xs font-semibold text-red-400">❌ Sin elegir</span>;
  }
  return (
    <span className="text-xs font-semibold text-emerald-400">
      ✅ J1: {jornada1}
      {status === "eliminated" && (
        <span className="ml-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
          ELIMINADO
        </span>
      )}
    </span>
  );
}

function ReadinessBadge({ user }: { user: UserAudit }) {
  const classicReady =
    !user.has_paid_classic ||
    (user.classic_picks_total > 0 && user.classic_picks_filled === user.classic_picks_total);

  const survivalReady = !user.has_paid_survival || !!user.survival_jornada1_pick;

  const isReady = classicReady && survivalReady;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
        isReady
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-400"
      )}
    >
      {isReady ? "Listo" : "Pendiente"}
    </span>
  );
}
