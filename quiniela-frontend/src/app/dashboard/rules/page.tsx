"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageContext";
import { translations } from "@/lib/translations";

export default function RulesPage() {
  const { language } = useLanguage();
  const t = translations[language].rules;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">

      {/* ── Título ── */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          {t.tag}
        </p>
        <h1 className="text-2xl font-black text-white">
          {t.title}
          <span className="ml-2 text-cyan-400">{t.worldCup}</span>
        </h1>
        <p className="text-sm text-slate-400">
          {t.subtitle}
        </p>
      </div>

      {/* ── 1. Formato ── */}
      <Card accent="cyan">
        <SectionTitle number="1" label={t.formatTitle} color="text-cyan-400" />
        <p className="mb-4 text-sm text-slate-400">
          {t.formatDesc}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            emoji="🏆"
            title={t.classicTitle}
            subtitle={t.classicSub}
            description={t.classicDesc}
            borderColor="border-cyan-500/30"
            bgColor="bg-cyan-500/5"
            textColor="text-cyan-300"
          />
          <ModeCard
            emoji="💀"
            title={t.survivalTitle}
            subtitle={t.survivalSub}
            description={t.survivalDesc}
            borderColor="border-lime-500/30"
            bgColor="bg-lime-500/5"
            textColor="text-lime-300"
          />
        </div>
      </Card>

      {/* ── 2. Modo Clásico ── */}
      <Card accent="cyan">
        <SectionTitle number="2" label={t.rulesClassicTitle} color="text-cyan-400" />
        <p className="mb-3 text-sm text-slate-400">
          {t.rulesClassicDesc}
        </p>
        <div className="space-y-3">
          <RuleRow
            badge={t.pts5}
            badgeColor="bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
            title={t.pts5Title}
            description={t.pts5Desc}
          />
          <RuleRow
            badge={t.pts3}
            badgeColor="bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
            title={t.pts3Title}
            description={t.pts3Desc}
          />
          <RuleRow
            badge={t.pts1}
            badgeColor="bg-amber-500/20 text-amber-300 border-amber-500/30"
            title={t.pts1Title}
            description={t.pts1Desc}
          />
          <RuleRow
            badge={t.pts0}
            badgeColor="bg-red-950/60 text-red-400 border-red-800/30"
            title={t.pts0Title}
            description={t.pts0Desc}
          />

          <Divider />

          <InfoRow
            icon="⚽"
            title={t.knockoutTitle}
            description={t.knockoutDesc}
          />
          <InfoRow
            icon="✕"
            title={t.multTitle}
            description={
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                {t.groups} <Pill label="×1" color="text-slate-400" /> ·
                {t.r32} <Pill label="×2" color="text-cyan-400" /> ·
                {t.r16} <Pill label="×3" color="text-teal-400" /> ·
                {t.r8} <Pill label="×4" color="text-emerald-400" /> ·
                {t.r4} <Pill label="×5" color="text-lime-400" /> ·
                {t.semi} <Pill label="×6" color="text-yellow-400" /> ·
                {t.finalMatch} <Pill label="×7" color="text-amber-400" />
              </span>
            }
          />
          <InfoRow
            icon="🎁"
            title={t.bonusTitle}
            description={
              <span className="block space-y-2 mt-1">
                <span className="block">• <strong>{t.bonus1a}</strong> {t.bonus1b} <span className="text-cyan-400 font-bold">+10 pts</span> {t.bonusExtras}</span>
                <span className="block">• <strong>{t.bonus2a}</strong> {t.bonus2b} <span className="text-cyan-400 font-bold">+10 pts</span> {t.bonusExtras}</span>
                <span className="block">• <strong>{t.bonus3a}</strong> {t.bonus3b} <span className="text-cyan-400 font-bold">+10 pts</span> {t.bonusExtras}</span>
                <span className="block">• <strong>{t.bonus4a}</strong> {t.bonus4b} <span className="text-cyan-400 font-bold">+10 pts</span> {t.bonusExtras}</span>
              </span>
            }
          />
        </div>
      </Card>

      {/* ── 3. Modo Supervivencia ── */}
      <Card accent="lime">
        <SectionTitle number="3" label={t.rulesSurvivalTitle} color="text-lime-400" />
        <div className="space-y-3">
          <InfoRow
            icon="🗓"
            title={t.mechTitle}
            description={t.mechDesc}
          />
          <InfoRow
            icon="⚡"
            title={t.surviveTitle}
            description={t.surviveDesc}
          />
          <div className="flex gap-3 rounded-xl border border-red-500/25 bg-red-950/20 p-4">
            <span className="shrink-0 text-lg">🚫</span>
            <div>
              <p className="text-sm font-bold text-red-300">{t.goldenTitle}</p>
              <p className="mt-0.5 text-sm text-slate-400">
                {t.goldenDesc1} <span className="font-semibold text-red-300">{t.goldenDescBold}</span> {t.goldenDesc2}
              </p>
            </div>
          </div>
          <InfoRow
            icon="🔒"
            title={t.lockTitle}
            description={t.lockDesc}
          />
        </div>
      </Card>

      {/* ── 4. Cierre de Picks ── */}
      <Card accent="none">
        <SectionTitle number="4" label={t.closeTitle} color="text-slate-300" />
        <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-950/15 p-4">
          <span className="shrink-0 text-lg">⏰</span>
          <p className="text-sm text-slate-300">
            {t.closeDesc1}{" "}
            <span className="font-bold text-amber-300">{t.closeDescBold}</span>{" "}
            {t.closeDesc2}
          </p>
        </div>
      </Card>

      {/* ── 5. Desempate ── */}
      <Card accent="cyan">
        <SectionTitle number="5" label={t.tieTitle} color="text-cyan-400" />
        <ol className="space-y-2">
          {[
            t.tie1,
            t.tie2,
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
        <SectionTitle number="6" label={t.prizeTitle} color="text-lime-400" />
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyan-400">
              {t.prizeClassic}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <PrizeBox place={t.place1} pct="60%" highlight />
              <PrizeBox place={t.place2} pct="20%" />
              <PrizeBox place={t.place3} pct="10%" />
              <PrizeBox place={t.admin} pct="10%" muted />
            </div>
          </div>

          <Divider />

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-lime-400">
              {t.prizeSurvival}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <PrizeBox place={t.lastSurvivor} pct="90%" highlight accent="lime" />
              <PrizeBox place={t.admin} pct="10%" muted />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {t.prizeNote}
            </p>
          </div>
        </div>
      </Card>

      {/* ── Footer ── */}
      <p className="pb-4 text-center text-xs text-slate-600">
        {t.footerNote}
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