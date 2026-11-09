import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  getCurrentUser,
  logout,
  type AuthUser,
} from "../services/authService";

export default function ClientHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    async function checkSession() {
      try {
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role !== "client") {
          navigate("/login", { replace: true });
          return;
        }

        setUser(currentUser);
      } catch {
        navigate("/login", { replace: true });
      }
    }

    void checkSession();
  }, [navigate]);

  async function handleLogout() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      // Mantém o usuário na página se o logout falhar.
    }
  }

  if (!user) {
    return <p className="p-8">Verificando sessão...</p>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-500">
            ChegaLogo
          </h1>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-700"
          >
            Sair
          </button>
        </header>

        <section className="mt-10 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">
            Olá, {user.name}!
          </h2>

          <p className="mt-3 text-gray-500">
            Bem-vindo à sua área de cliente da ChegaLogo.
          </p>

          <Link
            to="/tracking"
            className="mt-6 inline-block rounded-lg bg-blue-500 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Rastrear encomenda
          </Link>
        </section>
      </div>
    </main>
  );
}
