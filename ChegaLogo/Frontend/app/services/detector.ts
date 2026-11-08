
export interface TentativaLogin {
  username: string;
  password: string;
}

export interface ResultadoAnalise {
  recebido: boolean;
  classificacao: string;
  mensagem: string;
}

export async function analisarTentativa(
  dados: TentativaLogin
): Promise<ResultadoAnalise> {
  const resposta = await fetch("http://127.0.0.1:5000/analisar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dados),
  });

  if (!resposta.ok) {
    throw new Error(`Erro na API: ${resposta.status}`);
  }

  return (await resposta.json()) as ResultadoAnalise;
}
