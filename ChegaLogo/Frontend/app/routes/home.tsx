import { useEffect, useState, type SyntheticEvent } from "react";
import { useNavigate } from "react-router";

import {
  getCurrentUser,
  logout,
  type AuthUser,
} from "../services/authService";

import {
  getDeliveries,
  getDeliverySummary,
  type Delivery,
  type DeliveryStatus,
  type DeliverySummary,
} from "../services/deliveryService";

const statusLabels: Record<DeliveryStatus, string> = {
  PENDENTE: "Pendente",
  EM_TRANSITO: "Em trânsito",
  ENTREGUE: "Entregue",
  ATRASADA: "Atrasada",
};

const statusClasses: Record<DeliveryStatus, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  EM_TRANSITO: "bg-blue-100 text-blue-800",
  ENTREGUE: "bg-green-100 text-green-800",
  ATRASADA: "bg-red-100 text-red-800",
};

function formatDate(date: string) {
  if (!date) return "-";

  const [year, month, day] = date.slice(0, 10).split("-");

  return `${day}/${month}/${year}`;
}

export default function Home() {
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [summary, setSummary] = useState<DeliverySummary | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
       
      const currentUser = await getCurrentUser();

      if (!active) return;

      if (!currentUser || currentUser.role !== "admin") {
        navigate("/admin/login", { replace: true });
        return;
      }

        setUser(currentUser);

        const [summaryData, deliveryData] = await Promise.all([
          getDeliverySummary(),
          getDeliveries(),
        ]);

        if (!active) return;

        setSummary(summaryData);
        setDeliveries(deliveryData);
      } catch (err) {
        if (!active) return;

        if (
          err instanceof Error &&
          err.message === "SESSION_EXPIRED"
        ) {
          navigate("/login", { replace: true });
          return;
        }

        setError("Não foi possível carregar o Dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSearch(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    setSearching(true);
    setError("");

    try {
      const result = await getDeliveries(search);
      setDeliveries(result);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "SESSION_EXPIRED"
      ) {
        navigate("/login", { replace: true });
        return;
      }

      setError("Erro ao pesquisar entregas.");
    } finally {
      setSearching(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setError("");

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setError("Não foi possível encerrar a sessão.");
      setLoggingOut(false);
    }
  }

  const cards = summary
    ? [
        {
          label: "Total de entregas",
          value: summary.totalDeliveries,
          color: "text-blue-600",
        },
        {
          label: "Em trânsito",
          value: summary.inTransit,
          color: "text-sky-600",
        },
        {
          label: "Entregues",
          value: summary.delivered,
          color: "text-green-600",
        },
        {
          label: "Atrasadas",
          value: summary.delayed,
          color: "text-red-600",
        },
      ]
    : [];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">
          Carregando painel da ChegaLogo...
        </p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-blue-700">
              ChegaLogo
            </h1>
            <p className="text-sm text-gray-500">
              Gestão de transportes e entregas
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-gray-800">
                {user.name}
              </p>
              <p className="text-xs text-gray-500">
                {user.role}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {loggingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7 px-4 py-8 md:px-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Dashboard operacional
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Acompanhe as operações e entregas da transportadora.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Indicadores */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-gray-500">
                {card.label}
              </p>
              <p className={`mt-3 text-3xl font-bold ${card.color}`}>
                {card.value}
              </p>
            </div>
          ))}
        </section>

        {/* Entregas */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Gestão de entregas
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Consulte as entregas registradas no sistema.
              </p>
            </div>

            <form
              onSubmit={handleSearch}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                maxLength={200}
                placeholder="Código, destino ou destinatário"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 sm:w-72"
              />

              <button
                type="submit"
                disabled={searching}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {searching ? "Buscando..." : "Pesquisar"}
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-4">Rastreamento</th>
                  <th className="px-5 py-4">Destinatário</th>
                  <th className="px-5 py-4">Destino</th>
                  <th className="px-5 py-4">Previsão</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {deliveries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-gray-500"
                    >
                      Nenhuma entrega encontrada.
                    </td>
                  </tr>
                ) : (
                  deliveries.map((delivery) => (
                    <tr
                      key={delivery.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-blue-700">
                        {delivery.trackingCode}
                      </td>
                      <td className="px-5 py-4 text-gray-800">
                        {delivery.recipient}
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {delivery.destination}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                        {formatDate(delivery.estimatedDelivery)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                            statusClasses[delivery.status]
                          }`}
                        >
                          {statusLabels[delivery.status]}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            {deliveries.length} entrega(s) encontrada(s).
          </div>
        </section>

        <p className="text-center text-xs text-gray-400">
          ChegaLogo — Ambiente de demonstração com dados fictícios.
        </p>
      </main>
    </div>
  );
}
