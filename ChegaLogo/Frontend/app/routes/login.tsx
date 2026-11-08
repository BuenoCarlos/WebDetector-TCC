
import { useState, type FormEvent } from "react";
import {
  analisarTentativa,
  type ResultadoAnalise,
} from "../services/detector";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resultado, setResultado] =
    useState<ResultadoAnalise | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setResultado(null);
    setCarregando(true);

    try {
      const resposta = await analisarTentativa({
        username,
        password,
      });

      setResultado(resposta);
    } catch {
      setErro("Não foi possível comunicar com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-3">
      <div className="truck-road min-h-48 md:col-span-2 md:min-h-screen" />
    <section className="flex min-w-0 flex-col items-center justify-center px-4 py-8 sm:px-8 md:col-span-1">
    <div className="w-full max-w-md">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 sm:text-4xl">
        Acessar conta
      </h1>

      <p className="mb-6 text-base text-gray-500 sm:text-lg">
        Entre com suas credenciais para continuar.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="username"
            className="mb-1 block text-base font-medium text-gray-700"
          >
            Usuário
          </label>

          <input
            id="username"
            type="text"
            autoComplete="off"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-base font-medium text-gray-700"
          >
            Senha
          </label>

          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {carregando ? "Analisando..." : "Entrar"}
        </button>

        <hr className="border-gray-300"/>
        {/* <p className="flex justify-end gap-2">Não tem uma conta?
        <Link to="/registerUser" className="text-blue-500 hover:text-blue-700">Cadastrar</Link> </p> */}
        <p className="text-center text-sm text-gray-500">Transportadora ChegaLogo</p>
      </form>

      {erro && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {erro}
        </p>
      )}

      {resultado && (
        <div
          role="status"
          className="mt-5 break-words rounded-lg bg-gray-100 p-4 text-sm text-gray-800"
        >
          <p>
            <strong>Classificação:</strong>{" "}
            {resultado.classificacao}
          </p>
          <p className="mt-1">{resultado.mensagem}</p>
        </div>
      )}
    </div> 
    </section>
    </main>
  );
}
