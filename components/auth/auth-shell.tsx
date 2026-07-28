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
    <main className="grid min-h-screen bg-slate-100 text-slate-950 lg:grid-cols-[minmax(380px,0.86fr)_minmax(540px,1.14fr)]">
      <section className="hidden border-r border-slate-800 bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-cyan-600 shadow-lg shadow-cyan-950/30">
            <Warehouse className="size-6" />
          </span>
          <div><p className="text-xs font-semibold uppercase text-cyan-300">POS</p><p className="text-lg font-semibold">Inventory Management</p></div>
        </div>
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight">Accurate stock data for every movement.</p>
          <p className="mt-4 text-sm leading-6 text-slate-300">Secure access for administrators, managers, and warehouse staff.</p>
          <div className="mt-8 grid gap-3 text-sm text-slate-300">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4"><span className="font-semibold text-white">Live controls</span><p className="mt-1 text-slate-400">Stock in, stock out, transfers, and adjustments stay traceable.</p></div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4"><span className="font-semibold text-white">Role access</span><p className="mt-1 text-slate-400">Admin, manager, and staff workflows stay separated.</p></div>
          </div>
        </div>
        <p className="text-xs text-slate-400">Inventory Operations Platform</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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
