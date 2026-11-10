
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router";

import {
  getCurrentUser,
  logout,
  type AuthUser,
} from "../services/authService";

import {
  trackDelivery,
  type TrackingResult,
} from "../services/trackingService";

const statusConfig: Record<
  TrackingResult["status"],
  { label: string; color: string }
> = {
  PENDENTE: {
    label: "Pendente",
    color: "bg-amber-100 text-amber-700",
  },
  EM_TRANSITO: {
    label: "Em trânsito",
    color: "bg-blue-100 text-blue-700",
  },
  ENTREGUE: {
    label: "Entregue",
    color: "bg-green-100 text-green-700",
  },
  ATRASADA: {
    label: "Atrasada",
    color: "bg-red-100 text-red-700",
  },
};

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export default function ClientHome() {
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "profile"
  >("dashboard");

  const [trackingCode, setTrackingCode] = useState("");
  const [tracking, setTracking] =
    useState<TrackingResult | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();

        if (!active) return;

        if (!currentUser || currentUser.role !== "client") {
          navigate("/login", { replace: true });
          return;
        }

        setUser(currentUser);
      } catch {
        if (active) {
          navigate("/login", { replace: true });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadUser();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleLogout() {
    setLoggingOut(true);
    setPageError("");

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setPageError("Não foi possível encerrar sua sessão.");
      setLoggingOut(false);
    }
  }

  async function handleTracking(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setTracking(null);
    setTrackingError("");
    setTrackingLoading(true);

    try {
      const result = await trackDelivery(trackingCode);
      setTracking(result);
    } catch (err) {
      setTrackingError(
        err instanceof Error
          ? err.message
          : "Não foi possível consultar a encomenda."
      );
    } finally {
      setTrackingLoading(false);
    }
  }

  const selectTab = (tab: "dashboard" | "profile") => {
    setActiveTab(tab);
    setMenuOpen(false);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-500" />
          <p className="text-sm text-gray-500">
            Carregando sua conta...
          </p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const firstName = user.name.split(" ")[0];
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((name) => name.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
        <div className="flex h-18 items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg border border-gray-200 p-2 text-gray-600 lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
            >
              ☰
            </button>

            <div>
              <Link
                to="/client/home"
                className="text-2xl font-bold text-blue-500"
              >
                ChegaLogo
              </Link>

              <p className="text-xs text-gray-500">
                Portal do cliente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-gray-900">
                {user.name}
              </p>
              <p className="text-xs text-gray-500">
                Cliente
              </p>
            </div>

            <button
              type="button"
              onClick={() => selectTab("profile")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600"
              aria-label="Minha conta"
            >
              {initials}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-screen-2xl">

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-gray-200 bg-white pt-22 transition-transform lg:sticky lg:top-18 lg:z-0 lg:h-[calc(100vh-72px)] lg:translate-x-0 lg:pt-0 ${
            menuOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col justify-between p-4">
            <nav className="space-y-2">
              <p className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Minha área
              </p>

              <button
                type="button"
                onClick={() => selectTab("dashboard")}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
                  activeTab === "dashboard"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Início
              </button>

              <Link
                to="/"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
              >
                Rastrear encomenda
              </Link>

              <button
                type="button"
                onClick={() => selectTab("profile")}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
                  activeTab === "profile"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Minha conta
              </button>
              <Link
                to="/client/support"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                >
                Suporte
              </Link>
            </nav>

            <div className="border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {loggingOut ? "Saindo..." : "Sair da conta"}
              </button>
            </div>
          </div>
        </aside>

        {menuOpen && (
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            aria-label="Fechar menu"
          />
        )}

        <main className="min-w-0 flex-1 px-4 py-8 md:px-8">

          {pageError && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {pageError}
            </div>
          )}

          {activeTab === "dashboard" ? (
            <div className="space-y-7">

              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
                <span className="text-sm font-medium text-blue-500">
                  Portal do cliente
                </span>

                <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
                  Olá, {firstName}!
                </h1>

                <p className="mt-2 max-w-2xl text-gray-500">
                  Bem-vindo à ChegaLogo. Acompanhe suas
                  encomendas e consulte informações
                  sobre suas entregas em um só lugar.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-lg font-bold text-gray-900">
                  Acesso rápido
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Link
                    to="/tracking"
                    className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                  >

                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                      Rastrear encomenda
                    </h3>

                    <p className="mt-2 text-sm text-gray-500">
                      Consulte a localização e o status
                      de uma entrega pelo código.
                    </p>

                    <p className="mt-4 text-sm font-semibold text-blue-500">
                      Acessar rastreamento →
                    </p>
                  </Link>

                  <button
                    type="button"
                    onClick={() => selectTab("profile")}
                    className="group rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
                  >

                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                      Minha conta
                    </h3>

                    <p className="mt-2 text-sm text-gray-500">
                      Consulte suas informações
                      de usuário e dados da conta.
                    </p>

                    <p className="mt-4 text-sm font-semibold text-blue-500">
                      Visualizar meus dados →
                    </p>
                  </button>
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    Rastreamento rápido
                  </h2>

                  <p className="mt-2 text-sm text-gray-500">
                    Informe o código da encomenda
                    para acompanhar sua entrega.
                  </p>
                </div>

                <form
                  onSubmit={handleTracking}
                  className="flex flex-col gap-3 sm:flex-row"
                >
                  <input
                    type="text"
                    value={trackingCode}
                    onChange={(event) =>
                      setTrackingCode(
                        event.target.value.toUpperCase()
                      )
                    }
                    maxLength={11}
                    required
                    autoComplete="off"
                    placeholder="Ex.: CHG20260001"
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />

                  <button
                    type="submit"
                    disabled={trackingLoading}
                    className="rounded-lg bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {trackingLoading
                      ? "Consultando..."
                      : "Consultar"}
                  </button>
                </form>

                {trackingError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
                  >
                    {trackingError}
                  </p>
                )}

                {tracking && (
                  <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-500">
                          Código de rastreamento
                        </p>

                        <p className="mt-1 font-bold text-gray-900">
                          {tracking.trackingCode}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          statusConfig[tracking.status].color
                        }`}
                      >
                        {statusConfig[tracking.status].label}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 border-t border-blue-100 pt-5 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-gray-500">
                          Origem
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {tracking.origin}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">
                          Destino
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {tracking.destination}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">
                          Previsão de entrega
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {formatDate(
                            tracking.estimatedDelivery
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                <h3 className="font-semibold text-blue-800">
                  Precisa acompanhar uma entrega?
                </h3>

                <p className="mt-2 text-sm text-blue-700">
                  Tenha em mãos o código de rastreamento
                  fornecido pela ChegaLogo para consultar
                  a situação atual da sua encomenda.
                </p>
              </section>
            </div>
          ) : (

            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Minha conta
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                  Confira as informações da sua sessão.
                </p>
              </div>

              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
                <div className="mb-6 flex items-center gap-4 border-b border-gray-100 pb-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
                    {initials}
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">
                      {user.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Cliente ChegaLogo
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-500">
                      Nome completo
                    </p>
                    <p className="mt-1 font-medium">
                      {user.name}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">
                      Nome de usuário
                    </p>
                    <p className="mt-1 font-medium">
                      {user.username}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">
                      Tipo de conta
                    </p>
                    <p className="mt-1 font-medium">
                      Cliente
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}