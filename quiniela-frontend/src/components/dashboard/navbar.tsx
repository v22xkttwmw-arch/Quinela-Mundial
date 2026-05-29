"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Liga" },
  { href: "/dashboard/groups", label: "Grupos" },
  { href: "/dashboard/bracket", label: "Bracket" },
  { href: "/dashboard/predict", label: "Predecir" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    Cookies.remove("token");
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700/40 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-extrabold tracking-tight text-white">
            SMR
          </span>
          <span className="hidden text-sm font-semibold text-slate-400 sm:block">
            Quinielas <span className="text-blue-400">2026</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden gap-0.5 sm:flex">
          {NAV_LINKS.map(({ href, label }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                {label}
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
