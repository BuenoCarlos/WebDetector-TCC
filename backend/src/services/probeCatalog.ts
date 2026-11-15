// Testes controlados somente para aplicações locais autorizadas.
// Estas entradas são casos de teste, NÃO o dataset de treino/teste estatístico.
export const SQLI_PROBES = [
  {name:"Comparação de strings", falseValue:"' OR '1'='2' -- ", trueValue:"' OR '1'='1' -- "},
  {name:"Comparação numérica", falseValue:"' OR 1=2 -- ",trueValue:"' OR 1=1 -- "},
  {name:"Expressão aritmética",falseValue:"' OR (2+2)=5 -- ",trueValue:"' OR (2+2)=4 -- "},
  {name:"Operador LIKE",falseValue:"' OR 'teste' LIKE 'xyz%' -- ",trueValue:"' OR 'teste' LIKE 'te%' -- "},
  {name:"Função LENGTH",falseValue:"' OR LENGTH('abc')=4 -- ",trueValue:"' OR LENGTH('abc')=3 -- "},
] as const;

export function xssPayloads(token: string) {
  const assignment = `window.__webdetector_xss='${token}'`;
  return [
    {name:"SVG onload",value:`<svg onload="${assignment}"></svg>`},
    {name:"IMG onerror",value:`<img src=x onerror="${assignment}">`},
    {name:"Script inline",value:`<script>${assignment}</script>`},
  ];
}
