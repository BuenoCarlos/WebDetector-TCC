
import { useNavigate } from "react-router";

export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-gray-900">
        Honeypot Web
      </h1>

      <p className="text-gray-600">
        Ambiente de monitoramento de tentativas de acesso.
      </p>

      <button
        onClick={() => navigate("/login")}
        className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
      >
        Acessar login
      </button>
    </main>
  );
}
