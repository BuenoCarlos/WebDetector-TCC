import { useState, type SyntheticEvent } from "react";
import { Link } from "react-router";
import { registerClient } from "../services/clientService";

export default function RegisterUser() {
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: keyof typeof form, value: string) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess(false);

    if (form.password !== form.confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (form.password.length < 8) {
      setError("A senha deve conter pelo menos 8 caracteres.");
      return;
    }

    if (
      form.phone.length > 0 &&
      !/^\d{10,11}$/.test(form.phone)
    ) {
      setError("O telefone deve conter 10 ou 11 números, incluindo o DDD.");
      return;
    }

    setLoading(true);

    try {
      await registerClient({
        fullName: form.fullName.trim(),
        username: form.username.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone,
        password: form.password,
      });

      setForm({
        fullName: "",
        username: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
      });

      setShowPassword(false);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível realizar o cadastro."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

  const labelClass =
    "mb-1.5 block text-sm font-medium text-gray-700";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-7 text-center">
          <Link
            to="/tracking"
            className="text-3xl font-bold text-blue-500"
          >
            ChegaLogo
          </Link>
          <p className="mt-2 text-sm text-gray-500">
            Transportadora ChegaLogo
          </p>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Criar conta
          </h1>

          <p className="mt-2 text-gray-500">
            Preencha seus dados para acompanhar suas
            encomendas e utilizar nossos serviços.
          </p>

          <hr className="my-7 border-gray-200" />

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="fullName" className={labelClass}>
                Nome completo
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={form.fullName}
                onChange={(e) =>
                  updateField("fullName", e.target.value)
                }
                minLength={3}
                maxLength={120}
                required
                placeholder="Digite seu nome completo"
                className={inputClass}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="username" className={labelClass}>
                  Usuário
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) =>
                    updateField("username", e.target.value.toLowerCase())
                  }
                  minLength={3}
                  maxLength={30}
                  pattern="[a-z0-9_]{3,30}"
                  title="Use 3 a 30 letras minúsculas, números ou _"
                  required
                  placeholder="Seu usuário"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="phone" className={labelClass}>
                  Telefone (opcional)
                </label>
                  <input
                    id="phone"
                    type="text"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => {
                      const apenasNumeros = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 11);

                      updateField("phone", apenasNumeros);
                    }}
                    minLength={10}
                    maxLength={11}
                    pattern="[0-9]{10,11}"
                    title="Informe 10 ou 11 números, incluindo o DDD"
                    placeholder="54999999999"
                    className={inputClass}
                  />
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) =>
                  updateField("email", e.target.value)
                }
                maxLength={254}
                required
                placeholder="seuemail@exemplo.com"
                className={inputClass}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className={labelClass}>
                  Senha
                </label>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) =>
                    updateField("password", e.target.value)
                  }
                  minLength={8}
                  maxLength={72}
                  required
                  placeholder="Mínimo 8 caracteres"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className={labelClass}>
                  Confirmar senha
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) =>
                    updateField("confirmPassword", e.target.value)
                  }
                  minLength={8}
                  maxLength={72}
                  required
                  placeholder="Repita sua senha"
                  className={inputClass}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) =>
                  setShowPassword(e.target.checked)
                }
                className="h-4 w-4 accent-blue-500"
              />
              Mostrar senhas
            </label>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                role="status"
                className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
              >
                <p className="font-semibold">
                  Usuário cadastrado com sucesso!
                </p>

                <p className="mt-1">
                  Sua conta foi criada e seus dados foram salvos.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-500 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Criando conta..." : "Criar minha conta"}
            </button>
          </form>

          <hr className="my-6 border-gray-200" />

          <p className="text-center text-sm text-gray-500">
            Já possui uma conta?{" "}
            <Link
              to="/login"
              className="font-semibold text-blue-500 hover:text-blue-700"
            >
              Entrar
            </Link>
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-gray-400">
          ChegaLogo — Ambiente de demonstração.
        </p>
      </div>
    </main>
  );
}