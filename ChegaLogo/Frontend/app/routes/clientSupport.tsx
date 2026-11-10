
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { getCurrentUser } from "../services/authService";
import {
  createSupportTicket,
  getMySupportTickets,
  type SupportTicket,
} from "../services/supportService";

const statusColors = {
  ABERTO: "bg-blue-100 text-blue-700",
  EM_ANALISE: "bg-amber-100 text-amber-700",
  RESOLVIDO: "bg-green-100 text-green-700",
};

const statusLabels = {
  ABERTO: "Aberto",
  EM_ANALISE: "Em análise",
  RESOLVIDO: "Resolvido",
};

export default function ClientSupport() {
  const navigate = useNavigate();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const user = await getCurrentUser();

        if (!active) return;

        if (!user || user.role !== "client") {
          navigate("/login", { replace: true });
          return;
        }

        setAuthorized(true);

        const data = await getMySupportTickets();
        if (active) setTickets(data);
      } catch (err) {
        if (!active) return;

        if (
          err instanceof Error &&
          err.message === "SESSION_EXPIRED"
        ) {
          navigate("/login", { replace: true });
        } else {
          setError("Não foi possível carregar suas solicitações.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSuccess("");
    setError("");
    setSending(true);

    try {
      const ticket = await createSupportTicket({
        subject,
        message,
      });

      setTickets((previous) => [ticket, ...previous]);
      setSubject("");
      setMessage("");
      setSuccess("Solicitação enviada com sucesso!");
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "SESSION_EXPIRED"
      ) {
        navigate("/login", { replace: true });
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Erro ao enviar a solicitação."
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Carregando suporte...</p>
      </main>
    );
  }

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link
            to="/client/home"
            className="text-2xl font-bold text-blue-500"
          >
            ChegaLogo
          </Link>

          <Link
            to="/client/home"
            className="text-sm font-medium text-blue-500 hover:text-blue-700"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-7 px-4 py-8">
        <div>
          <h1 className="text-3xl font-bold">Central de suporte</h1>
          <p className="mt-2 text-gray-500">
            Entre em contato com nossa equipe e acompanhe
            suas solicitações.
          </p>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-5 text-xl font-semibold">
            Nova solicitação
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="subject"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Assunto
              </label>

              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                minLength={3}
                maxLength={120}
                required
                placeholder="Ex.: Dúvida sobre minha entrega"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Mensagem
              </label>

              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                minLength={5}
                maxLength={2000}
                rows={6}
                required
                placeholder="Descreva sua dúvida ou solicitação..."
                className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />

              <p className="mt-1 text-right text-xs text-gray-400">
                {message.length}/2000 caracteres
              </p>
            </div>

            {success && (
              <div
                role="status"
                className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
              >
                {success}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {sending ? "Enviando..." : "Enviar solicitação"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-5 text-xl font-semibold">
            Minhas solicitações
          </h2>

          {tickets.length === 0 ? (
            <p className="text-sm text-gray-500">
              Você ainda não possui solicitações.
            </p>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <article
                  key={ticket.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <h3 className="font-semibold break-words">
                      {ticket.subject}
                    </h3>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        statusColors[ticket.status]
                      }`}
                    >
                      {statusLabels[ticket.status]}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-600">
                    {ticket.message}
                  </p>

                  <p className="mt-3 text-xs text-gray-400">
                    Solicitação #{ticket.id}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
