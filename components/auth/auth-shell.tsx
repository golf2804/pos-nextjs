import { Warehouse } from "lucide-react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-stone-50 lg:grid-cols-[minmax(360px,0.8fr)_minmax(520px,1.2fr)]">
      <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-cyan-600">
            <Warehouse className="size-6" />
          </span>
          <div><p className="text-sm font-semibold text-cyan-300">POS</p><p className="text-lg font-semibold">Inventory Management</p></div>
        </div>
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight">Accurate stock data for every movement.</p>
          <p className="mt-4 text-sm leading-6 text-slate-300">Secure access for administrators, managers, and warehouse staff.</p>
        </div>
        <p className="text-xs text-slate-400">Inventory Operations Platform</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white"><Warehouse className="size-5" /></span>
            <p className="font-semibold">POS Inventory</p>
          </div>
          <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
