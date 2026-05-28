"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PagarPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState("");

  async function handlePagar() {
    setError("");
    setIsLoading(true);
    try {
      const { data } = await api.post<{ checkout_url: string }>(
        "/payments/create-checkout-session"
      );
      window.location.href = data.checkout_url;
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Error al conectar con la pasarela de pago.";
      setError(detail);
      setIsLoading(false);
    }
  }

  async function handleSimular() {
    setError("");
    setIsSimulating(true);
    try {
      await api.post("/simulate-payment/");
      router.push("/payment-success");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Error al simular el pago.";
      setError(detail);
      setIsSimulating(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Inscripción a la Quiniela</CardTitle>
          <CardDescription>
            Paga tu inscripción para acceder a la liga global, hacer
            predicciones y competir en el modo supervivencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 px-6 py-4 text-center">
            <p className="text-sm text-muted-foreground">Precio de inscripción</p>
            <p className="text-4xl font-bold mt-1">€10</p>
            <p className="text-xs text-muted-foreground mt-1">pago único</p>
          </div>

          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>✓ Acceso completo a la liga global</li>
            <li>✓ Predicciones de todos los partidos</li>
            <li>✓ Modo supervivencia</li>
            <li>✓ Clasificación en tiempo real</li>
          </ul>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handlePagar}
            disabled={isLoading || isSimulating}
          >
            {isLoading ? "Redirigiendo a Stripe..." : "Pagar Inscripción"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Solo en desarrollo
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleSimular}
            disabled={isLoading || isSimulating}
          >
            {isSimulating ? "Simulando..." : "Simular Pago (Dev)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
