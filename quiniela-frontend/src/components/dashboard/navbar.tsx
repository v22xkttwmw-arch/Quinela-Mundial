"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/useUser";
import api from "@/lib/api";

type NavLink = {
  href: string;
  label: string;
  requiresPlan?: "classic" | "vip";
};

const NAV_LINKS: NavLink[] = [
  { href: "/dashboard",             label: "Liga" },
  { href: "/dashboard/rendimiento", label: "Mi Rendimiento" },
  { href: "/dashboard/predict",     label: "Predecir",       requiresPlan: "classic" },
  { href: "/dashboard/supervivencia", label: "Supervivencia", requiresPlan: "vip" },
  { href: "/dashboard/checkout",    label: "Pase" },
  { href: "/dashboard/rules",       label: "Reglamento" },
];

const PLAN_LABEL: Record<string, string> = {
  basic:   "",
  classic: "Classic",
  vip:     "VIP",
};

const PLAN_BADGE: Record<string, string> = {
  classic: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
  vip:     "border-amber-400/50 bg-amber-400/10 text-amber-300",
};

export default function Navbar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { planType } = useUser();

  async function handleLogout() {
    try { await api.post("/logout"); } catch (_) {}
    window.localStorage.removeItem("token");
    // Recarga completa para limpiar el caché de módulo de useUser
    window.location.href = "/login";
  }

  function isAllowed(link: NavLink): boolean {
    if (!link.requiresPlan) return true;
    if (link.requiresPlan === "classic") return planType !== "basic";
    if (link.requiresPlan === "vip")     return planType === "vip";
    return false;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700/40 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <img 
  src="/logo-mundial.png" 
  alt="Logo Mundial 2026" 
  className="h-45 w-auto object-contain sm:h-11 transform scale-200" 
/>
          <span className="hidden text-lg font-black tracking-widest text-white sm:block">
            MUNDIAL <span className="text-cyan-400">2026</span>
          </span>
          {planType !== "basic" && (
            <span className={cn(
              "hidden rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider sm:inline-block",
              PLAN_BADGE[planType] ?? ""
            )}>
              {PLAN_LABEL[planType]}
            </span>
          )}
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-3 overflow-x-auto whitespace-nowrap pb-2 w-full sm:w-auto sm:gap-0.5 sm:overflow-visible sm:pb-0">
          {NAV_LINKS.map((link) => {
            const allowed = isAllowed(link);
            const active  = link.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(link.href);

            if (!allowed) {
              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => router.push("/dashboard/upgrade")}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                    "cursor-pointer text-slate-600 hover:bg-white/5 hover:text-slate-400"
                  )}
                >
                  <span>🔒</span>
                  <span>{link.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-400 backdrop-blur-sm transition-all hover:border-slate-500/60 hover:text-white"
        >
          Salir
        </button>
      </div>
    </header>
  );
}