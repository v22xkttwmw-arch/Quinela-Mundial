type FeatureColor = "cyan" | "lime" | "amber" | "fuchsia";

const COLOR_STYLES: Record<FeatureColor, { border: string; bg: string; text: string }> = {
  cyan: { border: "border-cyan-500/20", bg: "bg-cyan-500/5", text: "text-cyan-300" },
  lime: { border: "border-lime-500/20", bg: "bg-lime-500/5", text: "text-lime-300" },
  amber: { border: "border-amber-500/20", bg: "bg-amber-500/5", text: "text-amber-300" },
  fuchsia: { border: "border-fuchsia-500/20", bg: "bg-fuchsia-500/5", text: "text-fuchsia-300" },
};

function FeatureCard({
  emoji,
  title,
  description,
  color,
}: {
  emoji: string;
  title: string;
  description: string;
  color: FeatureColor;
}) {
  const styles = COLOR_STYLES[color];
  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-3.5`}>
      <p className="mb-1 text-lg">{emoji}</p>
      <p className={`text-xs font-bold ${styles.text}`}>{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}

export function AuthShowcase() {
  return (
    <div className="flex flex-col justify-center gap-6 animate-in fade-in slide-in-from-left-6 duration-700">
      <div className="space-y-3 text-center lg:text-left">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400">
          Quiniela Oficial · Mundial 2026
        </p>
        <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl">
          Pronostica. Compite.{" "}
          <span className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">
            Gana.
          </span>
        </h1>
        <p className="mx-auto max-w-md text-sm text-slate-400 lg:mx-0">
          Únete a la Liga Global del Mundial 2026: pronostica marcadores, sobrevive
          jornada a jornada y compite por premios reales con tus amigos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FeatureCard
          emoji="🏆"
          title="Modo Clásico"
          description="Pronostica marcadores exactos. Suma hasta 5 pts por partido, con multiplicadores que crecen en cada fase eliminatoria."
          color="cyan"
        />
        <FeatureCard
          emoji="💀"
          title="Modo Supervivencia"
          description="Elige un equipo ganador en cada jornada. Si empata o pierde, quedas eliminado. No se puede repetir equipo."
          color="lime"
        />
        <FeatureCard
          emoji="🥇"
          title="Premios Individuales"
          description="Acierta al Goleador, Asistidor, Mejor Jugador Joven y Campeón del torneo para puntos extra."
          color="amber"
        />
        <FeatureCard
          emoji="💰"
          title="Premios Reales"
          description="Los mejores de la Liga Global y el último sobreviviente se reparten la bolsa de premios."
          color="fuchsia"
        />
      </div>
    </div>
  );
}
