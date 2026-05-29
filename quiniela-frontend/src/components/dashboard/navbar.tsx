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
    <header className="border-b border-slate-800 bg-slate-900">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Brand */}
        <Link
          href="/dashboard"
          className="text-sm font-bold tracking-tight text-white"
        >
          SMR <span className="text-blue-400">Quinielas</span>{" "}
          <span className="text-slate-400 font-normal">Mundial 2026</span>
        </Link>

        {/* Nav */}
        <nav className="hidden gap-1 sm:flex">
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
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
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
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
