
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { getCurrentUser } from "../services/authService";
import {
  getAdminSupportTickets,
  type SupportTicket,
} from "../services/supportService";

export default function AdminSupport() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const user = await getCurrentUser();

        if (!active) return;

        if (!user || user.role !== "admin") {
          navigate("/admin/login", { replace: true });
          return;
        }

        setAuthorized(true);

        const data = await getAdminSupportTickets();

        if (active) setTickets(data);
      } catch {
        if (active) {
          setError("Não foi possível carregar as solicitações.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (loading) {
    return <p className="p-8 text-gray-500">Carregando...</p>;
  }

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-gray-50 p-5 text-gray-900 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Solicitações de suporte
            </h1>
            <p className="mt-2 text-gray-500">
              Mensagens enviadas pelos clientes da ChegaLogo.
            </p>
          </div>

          <Link
            to="/admin/dashboard"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            Voltar ao Dashboard
          </Link>
        </header>

        {error && (
          <p role="alert" className="mb-5 text-red-600">
            {error}
          </p>
        )}

        <section className="space-y-4">
          {tickets.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-gray-500">
              Nenhuma solicitação encontrada.
            </div>
          ) : (
            tickets.map((ticket) => (
              <article
                key={ticket.id}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-blue-500">
                      Solicitação #{ticket.id}
                    </p>

                    <h2 className="mt-1 text-lg font-bold break-words">
                      {ticket.subject}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      {ticket.clientName} (@{ticket.clientUsername})
                    </p>
                  </div>

                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    {ticket.status === "EM_ANALISE"
                      ? "Em análise"
                      : ticket.status === "RESOLVIDO"
                        ? "Resolvido"
                        : "Aberto"}
                  </span>
                </div>

                <div className="mt-5 rounded-lg bg-gray-50 p-4">
                  <p className="whitespace-pre-wrap break-words text-sm text-gray-700">
                    {ticket.message}
                  </p>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
