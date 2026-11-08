import { useEffect, useState, type SyntheticEvent, } from "react";
import ScenarioRoutes from "../components/scenarios/ScenarioRoutes";

import {
  createScenario,
  listScenarios,
  type AttackType,
  type CreateScenarioDTO,
  type Scenario,
} from "../services/scenarioService";

const attackOptions: AttackType[] = [
  "SQL Injection",
  "XSS",
  "Brute Force",
];

const initialForm: CreateScenarioDTO = {
  name: "",
  description: "",
  base_url: "",
  attack_types: [],
  defenses: {
    sql_injection: false,
    xss: false,
    brute_force: false,
  },
  max_requests: 20,
  duration_seconds: 60,
  interval_ms: 2000,
  request_timeout_ms: 5000,
};

export default function ConfigCenario() {
  const [form, setForm] = useState<CreateScenarioDTO>({
    ...initialForm,
    attack_types: [],
    defenses: { ...initialForm.defenses },
  });

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadScenarios() {
    try {
      setLoading(true);
      setError("");
      const data = await listScenarios();
      setScenarios(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os cenários."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadScenarios();
  }, []);

  function toggleAttack(attack: AttackType) {
    setForm((previous) => ({
      ...previous,
      attack_types: previous.attack_types.includes(attack)
        ? previous.attack_types.filter((item) => item !== attack)
        : [...previous.attack_types, attack],
    }));
  }

  function toggleDefense(
    defense: keyof CreateScenarioDTO["defenses"]
  ) {
    setForm((previous) => ({
      ...previous,
      defenses: {
        ...previous.defenses,
        [defense]: !previous.defenses[defense],
      },
    }));
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (form.attack_types.length === 0) {
      setError("Selecione pelo menos um tipo de ataque.");
      return;
    }

    try {
      setSaving(true);
      const created = await createScenario(form);
      setScenarios((previous) => [created, ...previous]);
      setForm({
        ...initialForm,
        attack_types: [],
        defenses: { ...initialForm.defenses },
      });
      setSuccess("Cenário cadastrado com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível cadastrar o cenário."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Configuração de Cenários
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure os ambientes e os testes de segurança do WebDetector.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-gray-900">
            Informações do cenário
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="scenario-name"
                className="mb-2 block text-sm font-medium text-gray-700">
                Nome do cenário *
              </label>
              <input
                id="scenario-name"
                className={inputClass}
                placeholder="Ex.: ERP sem proteção"
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
                minLength={3}
                maxLength={150}
                required
              />
            </div>

            <div>
              <label
                htmlFor="scenario-url"
                className="mb-2 block text-sm font-medium text-gray-700">
                URL da aplicação *
              </label>
              <input
                id="scenario-url"
                type="url"
                className={inputClass}
                placeholder="http://127.0.0.1:8000"
                value={form.base_url}
                onChange={(event) =>
                  setForm({
                    ...form,
                    base_url: event.target.value,
                  })
                }
                required
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="scenario-description"
                className="mb-2 block text-sm font-medium text-gray-700">
                Descrição
              </label>
              <textarea
                id="scenario-description"
                className={inputClass}
                rows={3}
                maxLength={2000}
                placeholder="Descreva o objetivo do cenário..."
                value={form.description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description: event.target.value,
                  })
                }
              />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Tipos de ataque
            </h2>
            <p className="mb-5 mt-1 text-sm text-gray-500">
              Selecione os tipos que deseja avaliar.
            </p>

            <div className="space-y-3">
              {attackOptions.map((attack) => (
                <label
                  key={attack}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                    checked={form.attack_types.includes(attack)}
                    onChange={() => toggleAttack(attack)}
                  />
                  <span className="text-sm font-medium text-gray-800">
                    {attack}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Defesas para avaliação
            </h2>
            <p className="mb-5 mt-1 text-sm text-gray-500">
              Registre quais proteções devem estar habilitadas no ambiente.
            </p>

            <div className="space-y-3">
              {(
                [
                  ["sql_injection", "Proteção contra SQL Injection"],
                  ["xss", "Proteção contra XSS"],
                  ["brute_force", "Proteção contra Brute Force"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">
                    {label}
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600"
                    checked={form.defenses[key]}
                    onChange={() => toggleDefense(key)}
                  />
                </label>
              ))}
            </div>

            <p className="mt-4 text-xs text-gray-500">
              Esta configuração não ativa proteções automaticamente
              na aplicação-alvo.
            </p>
          </section>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Configuração da execução
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Defina os limites e a frequência dos testes.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            <div>
              <label
                htmlFor="maxRequests"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Número máximo de tentativas
              </label>
              <input
                id="maxRequests"
                type="number"
                min={1}
                max={100}
                required
                className={inputClass}
                value={form.max_requests}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    max_requests: Number(e.target.value),
                  }))
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                Quantidade máxima de requisições por execução.
              </p>
            </div>

            <div>
              <label
                htmlFor="duration"
                className="mb-2 block text-sm font-medium text-gray-700">
                Duração máxima (segundos)
              </label>
              <input
                id="duration"
                type="number"
                min={5}
                max={120}
                required
                className={inputClass}
                value={form.duration_seconds}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    duration_seconds: Number(e.target.value),
                  }))
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                Tempo limite para finalizar a execução.
              </p>
            </div>

            <div>
              <label
                htmlFor="interval"
                className="mb-2 block text-sm font-medium text-gray-700">
                Intervalo entre tentativas (ms)
              </label>
              <input
                id="interval"
                type="number"
                min={1000}
                max={10000}
                step={500}
                required
                className={inputClass}
                value={form.interval_ms}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    interval_ms: Number(e.target.value),
                  }))
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                1000 ms equivalem a 1 segundo.
              </p>
            </div>

            <div>
              <label
                htmlFor="timeout"
                className="mb-2 block text-sm font-medium text-gray-700">
                Timeout da requisição (ms)
              </label>
              <input
                id="timeout"
                type="number"
                min={1000}
                max={10000}
                step={500}
                required
                className={inputClass}
                value={form.request_timeout_ms}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    request_timeout_ms: Number(e.target.value),
                  }))
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                Tempo máximo de espera pela resposta.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">
              Resumo da configuração
            </p>
            <p className="mt-2 text-sm text-blue-800">
              Até {form.max_requests} tentativas em
              {" "}{form.duration_seconds} segundos,
              com intervalo mínimo de
              {" "}{form.interval_ms / 1000} segundos.
            </p>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar cenário"}
          </button>
        </div>
      </form>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Cenários cadastrados
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {scenarios.length} cenário(s) encontrado(s)
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadScenarios()}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Atualizar
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-gray-500">
            Carregando cenários...
          </p>
        ) : scenarios.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            Nenhum cenário cadastrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Cenário</th>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Ataques</th>
                  <th className="px-4 py-3">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scenarios.map((scenario) => (
                  <tr key={scenario.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">
                        {scenario.name}
                      </p>
                      <p className="mt-1 max-w-xs truncate text-xs text-gray-500">
                        {scenario.description || "Sem descrição"}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-gray-600">
                      <span className="break-all">
                        {scenario.base_url}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {scenario.attack_types.map((attack) => (
                          <span
                            key={attack}
                            className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                            {attack}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-gray-500">
                      {new Date(scenario.created_at).toLocaleDateString(
                        "pt-BR"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ScenarioRoutes scenarios={scenarios} />
    </main>
  );
}
