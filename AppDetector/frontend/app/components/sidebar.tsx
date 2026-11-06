import { Link, useLocation } from "react-router";
import { useState } from "react";
import { Button } from "flowbite-react";

import {
  HiOutlineViewGrid,
  HiOutlineCog,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineScale,
  HiOutlineDocumentReport,
} from "react-icons/hi";

export default function Sidebar() {
  const location = useLocation();
  const [recolhida, setRecolhida] = useState(false);

  const itens = [
    {
      nome: "Dashboard",
      caminho: "/",
      icone: HiOutlineViewGrid,
    },
    {
      nome: "Cenário",
      caminho: "/configCenario",
      icone: HiOutlineCog,
    },
    {
      nome: "Comparar cenários",
      caminho: "/compararCenarios",
      icone: HiOutlineScale,
    },
    {
      nome: "Monitoramento",
      caminho: "/monitoramento",
    },
    {
      nome: "Relatórios",
      caminho: "/relatorios",
      icone: HiOutlineDocumentReport,
    },
  ];

  return (
    <aside
      className={`fixed bottom-0 left-0 top-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ${
        recolhida ? "w-20" : "w-64"
      }`}>
      <div className="flex h-20 items-center justify-between border-b border-slate-200 px-5">
        {!recolhida && (
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2x1 font-bold tracking-wide text-slate-800">
                Analisador Local
              </h1>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-5">
        <nav className="space-y-2">
          {itens.map((item) => {
            const Icon = item.icone;
            const ativo =
              location.pathname === item.caminho;
            return (
              <Link
                key={item.caminho}
                to={item.caminho}
                title={recolhida ? item.nome : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                  ativo
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}>
                {!recolhida && (
                  <span>{item.nome}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto px-4 pb-5">
        <Button
          size="sm"
          className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200"
          onClick={() => setRecolhida(!recolhida)}>
          {recolhida ? (
            <HiOutlineChevronRight className="h-5 w-5" />
          ) : (
            <>
              <HiOutlineChevronLeft className="mr-2 h-4 w-4" />
              Recolher menu
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}