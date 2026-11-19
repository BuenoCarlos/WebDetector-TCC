import { Link, useLocation } from "react-router";
import { useState } from "react";

export default function Sidebar() {
  const location = useLocation();
  const [recolhida, setRecolhida] = useState(false);

  const itens = [
    {
      nome: "Dashboard",
      caminho: "/",
    },
    {
      nome: "Cenário",
      caminho: "/cenario",
    },
    {
      nome: "Comparar cenários",
      caminho: "/compararCenarios",
    },
    {
      nome: "Monitoramento",
      caminho: "/monitoramento",
    },
    {
      nome: "Relatórios",
      caminho: "/relatorios",

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
    </aside>
  );
}