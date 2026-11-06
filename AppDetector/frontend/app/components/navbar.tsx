import { useLocation } from "react-router";
import {  Button } from "flowbite-react";

import {
  HiOutlineAdjustments,
} from "react-icons/hi";

export default function Navbar() {
  const location = useLocation();

  const titulos: Record<string, string> = {
    "/": "Dashboard",
    "/configCenario": "Configurações",
    "/compararCenarios": "Comparação de cenários",
    "/monitoramento": "Monitoramento em tempo real",
    "/relatorios": "Relatórios e análises",
  };

  const titulo =
    titulos[location.pathname] || "Analisador Local";

  return (
    <header className="fixed left-0 right-0 top-0 z-30 border-b border-slate-200 bg-white shadow-sm sm:left-64">
      <div className="flex min-h-20 items-center justify-between gap-4 px-5 sm:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Painel de monitoramento
            </span>
          </div>

          <h1 className="mt-1 truncate text-xl font-bold text-slate-900">
            {titulo}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Button
            color="blue"
            size="sm"
            onClick={() => {
              window.location.href = "/configCenario";
            }}>
            <HiOutlineAdjustments className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">
              Novo cenário
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}