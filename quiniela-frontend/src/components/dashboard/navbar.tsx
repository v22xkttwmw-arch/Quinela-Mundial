"use client";

import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const router = useRouter();

  function handleLogout() {
    Cookies.remove("token");
    router.push("/login");
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <span className="font-semibold tracking-tight">SMR Quinielas Mundial</span>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>
    </header>
  );
}
