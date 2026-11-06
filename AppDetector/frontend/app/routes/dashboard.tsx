
import { useEffect, useState } from "react";

interface BackendStatus {
  status: string;
  message: string;
}

export default function Dashboard() {
  const [backend, setBackend] = useState<BackendStatus | null>(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function verificarBackend() {
      try {
        const resposta = await fetch(
          "http://127.0.0.1:5000/api/health"
        );

        if (!resposta.ok) {
          throw new Error("Erro na comunicaçao");
        }

        const dados: BackendStatus = await resposta.json();
        setBackend(dados);
      } catch {
        setErro(true);
      } finally {
        setCarregando(false);
      }
    }

    verificarBackend();
  }, []);

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold text-gray-800">
        Dashboard
      </h1>

      <p className="mb-6 text-gray-500">
        Monitoramento do sistema WebDetector.
      </p>

      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          Status do Backend
        </h2>

        {carregando ? (
          <p className="text-gray-500">Verificando conexão...</p>
        ) : erro ? (
          <p className="text-red-600">
            Não foi possível conectar ao backend.
          </p>
        ) : (
          <div>
            <p className="font-medium text-green-600">
              ● Backend conectado
            </p>

            <p className="mt-2 text-sm text-gray-600">
              {backend?.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
