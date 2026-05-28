import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-2xl">
            ✕
          </div>
          <CardTitle>Pago cancelado</CardTitle>
          <CardDescription>
            No se realizó ningún cargo. Puedes intentarlo de nuevo cuando
            quieras.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild className="w-full">
            <Link href="/pagar">Intentar de nuevo</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">Volver al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
