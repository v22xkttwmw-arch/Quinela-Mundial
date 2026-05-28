import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
            ✓
          </div>
          <CardTitle>¡Pago confirmado!</CardTitle>
          <CardDescription>
            Tu inscripción ha sido procesada. Ya puedes acceder a la liga global
            y comenzar a hacer tus predicciones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/dashboard">Ir al Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
