
import { Link, useLocation } from "react-router";
import { HiOutlineAdjustments } from "react-icons/hi";

export default function Navbar() {
  const location = useLocation();

  const pathname =
    location.pathname.replace(/\/+$/, "") || "/";

  const titulos: Record<string, string> = {
    "/": "Dashboard",
    "/cenario": "Configurações",
    "/compararCenarios": "Comparação de cenários",
    "/monitoramento": "Monitoramento em tempo real",
    "/relatorios": "Relatórios e análises",
  };

  const titulo =
    titulos[pathname] || "Analisador Local";

  const isPaginaCenario =
    pathname === "/cenario" ||
    pathname.startsWith("/cenario/") ||
    pathname === "/cenario" ||
    pathname.startsWith("/cenario/");

  return (
    <header className="fixed left-0 right-0 top-0 z-30 border-b border-slate-200 bg-white shadow-sm sm:left-64">
      <div className="flex min-h-20 items-center justify-between gap-4 px-5 sm:px-8">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Painel de monitoramento
          </p>

          <h1 className="mt-1 truncate text-xl font-bold text-slate-900">
            {titulo}
          </h1>
        </div>

        {!isPaginaCenario && (
          <Link
            to="/cenario"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <HiOutlineAdjustments className="h-4 w-4" />

            <span className="hidden sm:inline">
              Novo cenário
            </span>
          </Link>
        )}
      </div>
    </header>
  );
}