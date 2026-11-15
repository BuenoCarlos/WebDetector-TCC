import { useState, type FormEvent } from "react";
import { Link } from "react-router";

type LabUser = {
  id: number;
  username: string;
};

type LabResponse = {
  success: boolean;
  lab_authenticated?: boolean;
  message?: string;
  user?: LabUser;
  users?: LabUser[];
  total?: number;
};

export default function LabLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: number;
    data: LabResponse;
  } | null>(null);
  const [error, setError] = useState("");

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:8000/api";

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        `${API_URL}/lab/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "omit",
          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

      const data =
        (await response.json()) as LabResponse;

      setResult({
        status: response.status,
        data,
      });
    } catch {
      setError(
        "Não foi possível conectar ao laboratório."
      );
    } finally {
      setLoading(false);
    }
  }

  const authenticated =
    result?.data.success === true &&
    result?.data.lab_authenticated === true;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">

        <header className="bg-blue-500 px-7 py-6 text-white">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold">
              ChegaLogo
            </h1>
          </div>

          <p className="mt-2 text-sm text-blue-100">
            Ambiente isolado de testes de segurança
          </p>
        </header>

        <div className="space-y-6 p-7">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Login de laboratório
            </h2>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Usuário
              </label>

              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                autoComplete="off"
                required
                maxLength={100}
                placeholder="Informe o usuário"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Senha
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                autoComplete="off"
                required
                maxLength={200}
                placeholder="Informe a senha"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-500 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Verificando..."
                : "Entrar no laboratório"}
            </button>
          </form>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {result && (
            <section
              className={`rounded-lg border p-4 ${authenticated
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
                }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">
                  Resultado da autenticação
                </h3>

                <span className="text-xs font-semibold">
                  HTTP {result.status}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-700">
                {result.data.message ||
                  "Resposta recebida do servidor."}
              </p>


              {authenticated && (
                <div className="mt-3 rounded-lg bg-white p-4 text-sm">
                  <p className="font-semibold text-green-700">
                    Autenticação fictícia realizada
                  </p>

                  {result.data.users && result.data.users.length > 0 ? (
                    <div className="mt-4">
                      <p className="mb-3 font-medium text-slate-700">
                        Registros encontrados:{" "}
                        {result.data.total ?? result.data.users.length}
                      </p>

                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>
                              <th className="px-4 py-3">ID</th>
                              <th className="px-4 py-3">Usuário</th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100">
                            {result.data.users.map((user) => (
                              <tr key={user.id}>
                                <td className="px-4 py-3">{user.id}</td>
                                <td className="px-4 py-3 font-medium">
                                  {user.username}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : result.data.user ? (
                    <p className="mt-3 text-slate-600">
                      Usuário: {result.data.user.username}
                    </p>
                  ) : (
                    <p className="mt-3 text-slate-500">
                      Nenhum usuário retornado.
                    </p>
                  )}

                  <p className="mt-4 text-xs text-slate-500">
                    Dados fictícios retornados pelo laboratório.
                    Nenhuma sessão real foi criada.
                  </p>
                </div>
              )}

            </section>
          )}

          <div className="border-t border-slate-200 pt-5">
            <Link
              to="/login"
              className="block text-center text-sm font-medium text-blue-500 hover:text-blue-700"
            >
              Voltar ao login normal
            </Link>
          </div>

          <p className="text-center text-xs text-slate-400">
            ChegaLogo — Laboratório acadêmico.
            Utilize somente dados fictícios.
          </p>
        </div>
      </div>
    </main>
  );
}
