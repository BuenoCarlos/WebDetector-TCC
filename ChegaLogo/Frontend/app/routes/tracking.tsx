import { useState, type FormEvent } from "react";
import { Link } from "react-router";

import {
  trackDelivery,
  type TrackingResult,
} from "../services/trackingService";

const statusConfig: Record<
  TrackingResult["status"],
  { label: string; className: string }
> = {
  PENDENTE: {
    label: "Pendente",
    className: "bg-amber-100 text-amber-800",
  },
  EM_TRANSITO: {
    label: "Em trânsito",
    className: "bg-blue-100 text-blue-800",
  },
  ENTREGUE: {
    label: "Entregue",
    className: "bg-green-100 text-green-800",
  },
  ATRASADA: {
    label: "Atrasada",
    className: "bg-red-100 text-red-800",
  },
};

function formatDate(value: string) {
  const parts = value.slice(0, 10).split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function Tracking() {
  const [code, setCode] = useState("");
  const [delivery, setDelivery] =
    useState<TrackingResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setDelivery(null);
    setLoading(true);

    try {
      const result = await trackDelivery(code);
      setDelivery(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao consultar a encomenda."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link
            to="/tracking"
            className="text-2xl font-bold text-blue-700"
          >
            ChegaLogo
          </Link>

          <Link
            to="/login"
            className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Área do funcionário
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        <section className="rounded-2xl bg-white px-6 py-10 shadow-sm ring-1 ring-gray-200 md:px-12">
          <div className="mx-auto max-w-xl text-center">
            <span className="inline-block rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700">
              Rastreamento de encomendas
            </span>

            <h1 className="mt-5 text-3xl font-bold text-gray-900 md:text-4xl">
              Onde está minha encomenda?
            </h1>

            <p className="mt-3 text-gray-500">
              Digite seu código de rastreamento para
              acompanhar o andamento da entrega.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.toUpperCase())
              }
              placeholder="Ex.: CHG20260001"
              maxLength={11}
              autoComplete="off"
              required
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Consultando..." : "Rastrear"}
            </button>
          </form>

          <p className="mt-3 text-center text-xs text-gray-400">
            Código de exemplo: CHG20260001
          </p>

          {error && (
            <div
              role="alert"
              className="mx-auto mt-6 max-w-xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}
        </section>

        {delivery && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Código de rastreamento
                </p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">
                  {delivery.trackingCode}
                </h2>
              </div>

              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  statusConfig[delivery.status].className
                }`}
              >
                {statusConfig[delivery.status].label}
              </span>
            </div>

            <div className="my-6 border-t border-gray-100" />

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">
                  Origem
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {delivery.origin}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Destino
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {delivery.destination}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Previsão de entrega
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {formatDate(delivery.estimatedDelivery)}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
              Os dados apresentados correspondem ao
              status registrado pela transportadora.
            </div>
          </section>
        )}

        <p className="mt-8 text-center text-xs text-gray-400">
          ChegaLogo — Ambiente de demonstração com dados fictícios.
        </p>
      </main>
    </div>
  );
}
