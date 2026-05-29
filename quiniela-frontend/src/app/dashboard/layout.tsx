import Navbar from "@/components/dashboard/navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950">
      {/* Decorative glow orbs — backdrop for glassmorphism */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-blue-600/8 blur-3xl" />
        <div className="absolute top-1/3 -left-48 h-96 w-96 rounded-full bg-emerald-600/6 blur-3xl" />
        <div className="absolute -bottom-32 right-1/3 h-80 w-80 rounded-full bg-indigo-600/6 blur-3xl" />
      </div>

      <Navbar />
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
