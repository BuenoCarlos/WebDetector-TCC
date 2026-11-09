import { useState, type SyntheticEvent } from "react";
import { Link, useNavigate } from "react-router";
import { login } from "../services/authService";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(
    event: SyntheticEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErro("");
    setCarregando(true);

    try {
      const resposta = await login({
        username,
        password,
      });

      if (resposta.success) {
        if (resposta.user?.role !== "admin") {
          setErro(
            "Esta área é exclusiva para funcionários autorizados."
          );
          return;
        }

        navigate("/admin/dashboard", {
          replace: true,
        });
      }
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível comunicar com o servidor."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6">

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-500">
            ChegaLogo
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Área administrativa
          </p>
        </div>

        <hr className="mb-8 border-gray-200" />

        <h2 className="mb-2 text-3xl font-bold text-gray-900">
          Acessar conta
        </h2>

        <p className="mb-6 text-base text-gray-500">
          Entre com suas credenciais para continuar.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div>
            <label
              htmlFor="admin-username"
              className="mb-1 block text-base font-medium text-gray-700"
            >
              Usuário
            </label>

            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              required
              maxLength={100}
              placeholder="Digite seu usuário"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="mb-1 block text-base font-medium text-gray-700"
            >
              Senha
            </label>

            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
                placeholder="Digite sua senha"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-20 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                className="absolute inset-y-0 right-3 text-sm font-medium text-gray-500 hover:text-blue-500"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {erro && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-600"
            >
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>

          <hr className="border-gray-300" />

          <p className="text-center text-sm text-gray-500">
            Transportadora ChegaLogo
          </p>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/tracking"
            className="text-sm text-gray-500 transition hover:text-blue-500"
          >
            Voltar para rastreamento
          </Link>
        </div>
      </section>
    </main>
  );
}