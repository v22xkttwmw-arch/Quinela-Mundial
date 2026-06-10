import Link from "next/link";

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">

      {/* ── Título ── */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          Quiniela · Mundial 2026
        </p>
        <h1 className="text-2xl font-black text-white">
          Reglamento Oficial
          <span className="ml-2 text-cyan-400">Mundial 2026</span>
        </h1>
        <p className="text-sm text-slate-400">
          Lee con atención. Al adquirir tu pase aceptas estas reglas íntegramente.
        </p>
      </div>

      {/* ── 1. Formato ── */}
      <Card accent="cyan">
        <SectionTitle number="1" label="Formato de la Plataforma" color="text-cyan-400" />
        <p className="mb-4 text-sm text-slate-400">
          Al adquirir tu pase obtienes acceso a nuestros modos de juego.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            emoji="🏆"
            title="Modo Clásico"
            subtitle="Quiniela de Marcadores"
            description="Pronostica el resultado exacto de los partidos del torneo y suma puntos en la Liga Global."
            borderColor="border-cyan-500/30"
            bgColor="bg-cyan-500/5"
            textColor="text-cyan-300"
          />
          <ModeCard
            emoji="💀"
            title="Modo Supervivencia"
            subtitle="Muerte Súbita"
            description="Elige un equipo ganador por jornada para seguir con vida."
            borderColor="border-lime-500/30"
            bgColor="bg-lime-500/5"
            textColor="text-lime-300"
          />
        </div>
      </Card>

      {/* ── 2. Modo Clásico ── */}
      <Card accent="cyan">
        <SectionTitle number="2" label="Reglas del Modo Clásico" color="text-cyan-400" />
        <p className="mb-3 text-sm text-slate-400">
          Por cada partido, tus puntos dependen de qué tan cerca estuvo tu pronóstico
          del resultado real. Escala oficial:
        </p>
        <div className="space-y-3">
          <RuleRow
            badge="5 PTS"
            badgeColor="bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
            title="Marcador Exacto"
            description="Acertaste el marcador exacto de ambos equipos. Ej: pronosticaste 2-0 y el resultado fue 2-0."
          />
          <RuleRow
            badge="3 PTS"
            badgeColor="bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
            title="Ganador + Diferencia de Goles"
            description="Acertaste al ganador con la misma diferencia de goles, pero fallaste el marcador exacto. Ej: pronosticaste 3-1 y el resultado fue 2-0 (diferencia +2 en ambos)."
          />
          <RuleRow
            badge="1 PTO"
            badgeColor="bg-amber-500/20 text-amber-300 border-amber-500/30"
            title="Tendencia"
            description="Solo acertaste al ganador o empate, sin acertar la diferencia de goles ni el marcador exacto. Ej: pronosticaste 1-0 y el resultado fue 3-1."
          />
          <RuleRow
            badge="0 PTS"
            badgeColor="bg-red-950/60 text-red-400 border-red-800/30"
            title="Fallo"
            description="No acertaste ni al ganador ni al empate."
          />

          <Divider />

          <InfoRow
            icon="⚽"
            title="Fase Eliminatoria"
            description="Cuenta el marcador al término de los 120 minutos (tiempo reglamentario + prórroga). En caso de penales, debes seleccionar al equipo que avanza para obtener el punto de tendencia."
          />
          <InfoRow
            icon="✕"
            title="Multiplicadores por Fase"
            description={
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                Grupos <Pill label="×1" color="text-slate-400" /> ·
                32 de final <Pill label="×2" color="text-cyan-400" /> ·
                16 de final <Pill label="×3" color="text-teal-400" /> ·
                8 de final <Pill label="×4" color="text-emerald-400" /> ·
                4 de final <Pill label="×5" color="text-lime-400" /> ·
                Semifinal y 3er Puesto <Pill label="×6" color="text-yellow-400" /> ·
                Final <Pill label="×7" color="text-amber-400" />
              </span>
            }
          />
          <InfoRow
            icon="🎁"
            title="Bonificaciones Especiales"
            description={
              <span className="block space-y-2 mt-1">
                <span className="block">• <strong>Bono de Campeón Exacto:</strong> Acertar correctamente al campeón del torneo otorga <span className="text-cyan-400 font-bold">+10 pts</span> extras.</span>
                <span className="block">• <strong>Goleador del Torneo:</strong> Acertar al jugador con más goles otorga <span className="text-cyan-400 font-bold">+10 pts</span> extras.</span>
                <span className="block">• <strong>Asistidor del Torneo:</strong> Acertar al jugador con más asistencias otorga <span className="text-cyan-400 font-bold">+10 pts</span> extras.</span>
                <span className="block">• <strong>Mejor Jugador Joven:</strong> Acertar al ganador oficial de este premio otorga <span className="text-cyan-400 font-bold">+10 pts</span> extras.</span>
              </span>
            }
          />
        </div>
      </Card>

      {/* ── 3. Modo Supervivencia ── */}
      <Card accent="lime">
        <SectionTitle number="3" label="Reglas del Modo Supervivencia" color="text-lime-400" />
        <div className="space-y-3">
          <InfoRow
            icon="🗓"
            title="Mecánica"
            description="En cada una de las jornadas del torneo, elige a un solo equipo ganador antes de que cierre la ventana de picks."
          />
          <InfoRow
            icon="⚡"
            title="Sobrevivir o Morir"
            description="Si tu equipo gana (en 90 o 120 minutos), avanzas a la siguiente jornada. Si EMPATA o PIERDE, tu estado pasa automáticamente a ELIMINADO."
          />
          <div className="flex gap-3 rounded-xl border border-red-500/25 bg-red-950/20 p-4">
            <span className="shrink-0 text-lg">🚫</span>
            <div>
              <p className="text-sm font-bold text-red-300">Regla de Oro</p>
              <p className="mt-0.5 text-sm text-slate-400">
                Está <span className="font-semibold text-red-300">PROHIBIDO REPETIR EQUIPOS</span> durante todo el torneo. Cada selección debe ser un equipo diferente.
              </p>
            </div>
          </div>
          <InfoRow
            icon="🔒"
            title="Bloqueo de Equipos Usados"
            description="En la cartelera de cada jornada, los equipos que ya elegiste en jornadas anteriores aparecen deshabilitados."
          />
        </div>
      </Card>

      {/* ── 4. Cierre de Picks ── */}
      <Card accent="none">
        <SectionTitle number="4" label="Cierre de Picks" color="text-slate-300" />
        <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-950/15 p-4">
          <span className="shrink-0 text-lg">⏰</span>
          <p className="text-sm text-slate-300">
            Todos los pronósticos se bloquean automáticamente{" "}
            <span className="font-bold text-amber-300">15 minutos antes del pitazo inicial</span>{" "}
            de cada partido, sin excepciones ni apelaciones.
          </p>
        </div>
      </Card>

      {/* ── 5. Desempate ── */}
      <Card accent="cyan">
        <SectionTitle number="5" label="Criterios de Desempate (Liga Global)" color="text-cyan-400" />
        <ol className="space-y-2">
          {[
            "Mayor cantidad de Marcadores Exactos (aciertos de 5 puntos).",
            "Mayor cantidad de Aciertos de Tendencia (aciertos de 1 punto).",
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-400">
                {i + 1}
              </span>
              <p className="text-sm text-slate-300">{text}</p>
            </li>
          ))}
        </ol>
      </Card>

      {/* ── 6. Premios ── */}
      <Card accent="lime">
        <SectionTitle number="6" label="Distribución de Premios" color="text-lime-400" />
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyan-400">
              Bolsa Modo Clásico
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <PrizeBox place="1er Lugar" pct="60%" highlight />
              <PrizeBox place="2do Lugar" pct="20%" />
              <PrizeBox place="3er Lugar" pct="10%" />
              <PrizeBox place="Administración" pct="10%" muted />
            </div>
          </div>

          <Divider />

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-lime-400">
              Bolsa Modo Supervivencia
            </p>
            <div className="grid grid-cols-2 gap-2">
              <PrizeBox place="Último Sobreviviente" pct="90%" highlight accent="lime" />
              <PrizeBox place="Administración" pct="10%" muted />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Si hay múltiples sobrevivientes al final, el 90% se divide en partes iguales entre ellos.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Footer ── */}
      <p className="pb-4 text-center text-xs text-slate-600">
        Reglamento sujeto a cambios menores. Versión vigente al inicio del torneo.
      </p>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Card({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: "cyan" | "lime" | "none";
}) {
  const border =
    accent === "cyan"
      ? "border-cyan-500/20"
      : accent === "lime"
        ? "border-lime-500/20"
        : "border-slate-700/40";

  return (
    <div className={`rounded-2xl border ${border} bg-slate-900/60 p-5 backdrop-blur-xl`}>
      {children}
    </div>
  );
}

function SectionTitle({
  number,
  label,
  color,
}: {
  number: string;
  label: string;
  color: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className={`text-xs font-black tabular-nums ${color}`}>{number}.</span>
      <h2 className="text-sm font-extrabold uppercase tracking-[0.15em] text-white">
        {label}
      </h2>
    </div>
  );
}

function ModeCard({
  emoji,
  title,
  subtitle,
  description,
  borderColor,
  bgColor,
  textColor,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
}) {
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4`}>
      <p className="mb-1 text-xl">{emoji}</p>
      <p className={`text-sm font-bold ${textColor}`}>{title}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {subtitle}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}

function RuleRow({
  badge,
  badgeColor,
  title,
  description,
}: {
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-black tabular-nums ${badgeColor}`}>
        {badge}
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 text-base">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <div className="text-xs leading-relaxed text-slate-400 mt-0.5">{description}</div>
      </div>
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return <span className={`font-black ${color}`}>{label}</span>;
}

function Divider() {
  return <div className="border-t border-slate-800" />;
}

function PrizeBox({
  place,
  pct,
  highlight = false,
  muted = false,
  accent = "cyan",
}: {
  place: string;
  pct: string;
  highlight?: boolean;
  muted?: boolean;
  accent?: "cyan" | "lime";
}) {
  const accentPct = accent === "lime" ? "text-lime-400" : "text-cyan-400";
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        highlight
          ? accent === "lime"
            ? "border-lime-500/30 bg-lime-500/10"
            : "border-cyan-500/30 bg-cyan-500/10"
          : muted
            ? "border-slate-800 bg-slate-900/40"
            : "border-slate-700/40 bg-slate-900/60"
      }`}
    >
      <p className={`text-lg font-black tabular-nums ${highlight ? accentPct : muted ? "text-slate-600" : "text-white"}`}>
        {pct}
      </p>
      <p className="mt-0.5 text-[10px] font-medium text-slate-500">{place}</p>
    </div>
  );
}