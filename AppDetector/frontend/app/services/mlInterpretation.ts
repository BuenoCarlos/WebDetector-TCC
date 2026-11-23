type Prediction = {
  classification?: string | null;
};

type MLResult = {
  request?: Prediction | null;
  attack?: Prediction | null;
} | null | undefined;

export function interpretarML(ml: MLResult) {
  const request = ml?.request?.classification;
  const attack = ml?.attack?.classification;

  if (!request || !attack) {
    return {
      label: "ML indisponível",
      description: "Não foi possível obter a classificação.",
      className: "bg-slate-100 text-slate-700",
    };
  }

  if (request === "Anomalous" && attack === "norm") {
    return {
      label: "Suspeita — tipo não identificado",
      description:
        "O modelo detectou uma requisição anômala, " +
        "mas não identificou o tipo de ataque.",
      className: "bg-amber-100 text-amber-800",
    };
  }

  if (attack === "sqli" || attack === "xss") {
    const tipo = attack === "sqli" ? "SQL Injection" : "XSS";

    return {
      label: `${tipo} identificado pelo ML`,
      description:
        `O modelo identificou características de ${tipo}. ` +
        "Isso não confirma a exploração de uma vulnerabilidade.",
      className: "bg-orange-100 text-orange-800",
    };
  }

  if (request === "Valid" && attack === "norm") {
    return {
      label: "Requisição normal",
      description:
        "Os modelos não identificaram padrões de ataque.",
      className: "bg-emerald-100 text-emerald-800",
    };
  }

  return {
    label: "Classificação inconclusiva",
    description:
      "Os resultados não permitiram determinar " +
      "uma classificação consistente.",
    className: "bg-slate-100 text-slate-700",
  };
}