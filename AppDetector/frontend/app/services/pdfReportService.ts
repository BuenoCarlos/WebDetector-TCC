
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const API = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:4000/api"
).replace(/\/$/, "");

// =====================================================
// TIPOS
// =====================================================

type Test = {
  state: string;
  outcome?: string;
  field?: string;
  reason?: string;
  reportId?: string;
};

type Operation = {
  method: string;
  path: string;
  summary?: string;
  state: string;
  httpStatus: number | null;
  explanation?: string;
  sqlInjection: Test;
  xss: Test;
};

export type ScanForPdf = {
  id: string;
  scenarioId?: string;
  scenario_id?: string;
  status: string;
  startedAt?: string;
  started_at?: string;
  finishedAt?: string;
  finished_at?: string | null;
  total: number;
  completed: number;
  operations: Operation[];
  error?: string | null;
};

type Evidence = {
  status: number;
  content_type?: string;
  body_digest?: string;
  payload_reflected?: boolean;
  durationMs?: number;
  flags?: Record<string, boolean>;
  identity_fields_present?: string[];
  session_cookie_names?: string[];
  error?: string;
};

type Attempt = {
  name: string;
  payload: string;
  outcome: string;
  explanation: string;
  falseCondition?: Evidence | null;
  testResponse: Evidence;
  browser?: {
    checked: boolean;
    executed: boolean;
    error?: string;
  };
  ml?: {
    request?: {
      classification: string;
      algorithm?: string;
    };
    attack?: {
      classification: string;
      algorithm?: string;
    };
  } | null;
  ml_error?: string | null;
  signals?: Record<string, unknown>;
  recommendations?: string[];
};

export type AssessmentForPdf = {
  attackType: string;
  route: {
    method: string;
    path: string;
  };
  field: string;
  outcome: string;
  explanation: string;
  sentRequests: number;
  executedProbes: number;
  reference?: Evidence;
  results: Attempt[];
  recommendations?: string[];
};

type StoredAssessment = {
  id: string;
  scenario_id: string;
  created_at: string;
  report: AssessmentForPdf;
};

type AssessmentLink = {
  id: string;
  attack: "SQLi" | "XSS";
  operation: string;
};

// =====================================================
// FORMATAÇÃO
// =====================================================

function text(value: unknown): string {
  if (value === null || value === undefined) {
    return "Não informado";
  }

  return String(value)
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n");
}

function date(value?: string | null): string {
  if (!value) return "Não informado";

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? "Não informado"
    : parsed.toLocaleString("pt-BR");
}

function label(value?: string): string {
  const labels: Record<string, string> = {
    confirmed: "Vulnerabilidade demonstrada",
    suspected: "Suspeita - requer validação",
    not_confirmed: "Não demonstrada neste teste",
    inconclusive: "Inconclusivo",
    completed: "Concluído",
    failed: "Falha",
    checked: "HTTP verificado",
    skipped: "Não executado",
    not_applicable: "Não aplicável",
    not_supported_yet: "Não suportado",
    pending: "Pendente",
    auth_required: "Autenticação necessária",
    blocked: "Bloqueado",
    error: "Erro",
  };

  return labels[value || ""] || value || "Não informado";
}

function testLabel(test: Test): string {
  return test.state === "completed"
    ? label(test.outcome)
    : label(test.state);
}

function yesNo(value?: boolean) {
  return value === true ? "Sim" : "Não";
}

// =====================================================
// DOCUMENTO PROFISSIONAL
// =====================================================

function createPdf(
  title: string,
  scenarioName: string
) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const left = 16;
  const right = 194;
  const width = right - left;

  let y = 36;

  function nextPage() {
    pdf.addPage();
    y = 34;
  }

  function ensureSpace(height: number) {
    if (y + height > 273) {
      nextPage();
    }
  }

  function paragraph(
    content: unknown,
    size = 9,
    bold = false
  ) {
    pdf.setFont(
      "helvetica",
      bold ? "bold" : "normal"
    );

    pdf.setFontSize(size);
    pdf.setTextColor(51, 65, 85);

    const lines = pdf.splitTextToSize(
      text(content),
      width
    ) as string[];

    const lineHeight = size * 0.46 + 1.2;

    for (const line of lines) {
      ensureSpace(lineHeight);

      pdf.text(line || " ", left, y);
      y += lineHeight;
    }

    y += 2;
  }

  function heading(title: string) {
    ensureSpace(18);
    y += 5;

    pdf.setDrawColor(226, 232, 240);
    pdf.line(left, y, right, y);

    y += 8;

    pdf.setTextColor(30, 64, 175);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);

    const lines = pdf.splitTextToSize(
      text(title),
      width
    ) as string[];

    for (const line of lines) {
      ensureSpace(6);
      pdf.text(line, left, y);
      y += 6;
    }

    y += 3;
  }

  function field(name: string, value: unknown) {
    paragraph(
      `${name}: ${text(value)}`,
      9
    );
  }

  function code(content: string) {
    ensureSpace(10);

    pdf.setFont("courier", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);

    const lines = pdf.splitTextToSize(
      text(content),
      width - 8
    ) as string[];

    for (const line of lines) {
      ensureSpace(5);
      pdf.text(line || " ", left + 4, y);
      y += 4.5;
    }

    y += 4;
  }

  function table(
    headers: string[],
    rows: string[][]
  ) {
    ensureSpace(16);

    autoTable(pdf, {
      startY: y,
      head: [headers],
      body: rows,

      theme: "grid",

      margin: {
        top: 30,
        bottom: 24,
        left,
        right: 16,
      },

      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 3,
        overflow: "linebreak",
        valign: "top",
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
      },

      headStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },

      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },

      showHead: "everyPage",
    });

    const lastTable = (
      pdf as jsPDF & {
        lastAutoTable?: {
          finalY: number;
        };
      }
    ).lastAutoTable;

    y = (lastTable?.finalY ?? y) + 8;
  }

  
function save(filename: string): void {
  const totalPages = pdf.getNumberOfPages();

  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page);

    // Cabeçalho
    pdf.setFillColor(15, 39, 83);
    pdf.rect(0, 0, 210, 23, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);

    pdf.text("WebDetector", 16, 14);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);

    pdf.text(
      "Relatório técnico de segurança",
      194,
      14,
      { align: "right" }
    );

    // Rodapé
    pdf.setDrawColor(226, 232, 240);
    pdf.line(16, 282, 194, 282);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);

    pdf.text(
      "WebDetector | Testes em ambiente controlado",
      16,
      288
    );

    pdf.text(
      `Página ${page} de ${totalPages}`,
      194,
      288,
      { align: "right" }
    );
  }

  // Gera e baixa o PDF
  pdf.save(filename);
}


  // Identificação inicial
  paragraph(title, 17, true);
  field("Cenário", scenarioName);
  field("Gerado em", new Date().toLocaleString("pt-BR"));

  return {
    paragraph,
    heading,
    field,
    code,
    table,
    save,
  };
}

// =====================================================
// DETALHAMENTO DAS EVIDÊNCIAS
// =====================================================

function writeEvidence(
  doc: ReturnType<typeof createPdf>,
  name: string,
  evidence?: Evidence | null
) {
  if (!evidence) {
    doc.field(name, "Não disponível");
    return;
  }

  doc.field(`${name} - HTTP`, evidence.status);

  if (evidence.content_type) {
    doc.field(
      `${name} - Content-Type`,
      evidence.content_type
    );
  }

  if (evidence.durationMs !== undefined) {
    doc.field(
      `${name} - Duração`,
      `${evidence.durationMs} ms`
    );
  }

  if (evidence.body_digest) {
    doc.field(
      `${name} - Hash da resposta`,
      evidence.body_digest
    );
  }

  if (evidence.payload_reflected !== undefined) {
    doc.field(
      `${name} - Payload refletido`,
      yesNo(evidence.payload_reflected)
    );
  }

  if (evidence.error) {
    doc.field(
      `${name} - Erro`,
      evidence.error
    );
  }
}

function writeAssessment(
  doc: ReturnType<typeof createPdf>,
  assessment: AssessmentForPdf,
  index: number
) {
  doc.heading(
    `${index}. ${assessment.attackType} - ` +
    `${assessment.route.method} ${assessment.route.path}`
  );

  doc.field("Campo testado", assessment.field);
  doc.field(
    "Resultado geral",
    label(assessment.outcome)
  );

  doc.field(
    "Requisições enviadas",
    assessment.sentRequests
  );

  doc.field(
    "Tentativas analisadas",
    assessment.executedProbes
  );

  doc.paragraph(assessment.explanation);

  writeEvidence(
    doc,
    "Requisição de referência",
    assessment.reference
  );

  if (!assessment.results.length) {
    doc.paragraph(
      "Nenhuma tentativa detalhada foi registrada nesta avaliação."
    );
  }

  // Cada tentativa real recebe seu próprio detalhamento.
  assessment.results.forEach((attempt, attemptIndex) => {
    doc.heading(
      `${index}.${attemptIndex + 1} - ${attempt.name}`
    );

    doc.field(
      "Conclusão da tentativa",
      label(attempt.outcome)
    );

    doc.paragraph("Payload utilizado:", 9, true);
    doc.code(attempt.payload);

    writeEvidence(
      doc,
      "Condição de controle",
      attempt.falseCondition
    );

    writeEvidence(
      doc,
      "Resposta ao payload",
      attempt.testResponse
    );

    if (attempt.browser) {
      doc.field(
        "Verificação no navegador",
        attempt.browser.checked
          ? "Executada"
          : "Não executada"
      );

      doc.field(
        "JavaScript executado",
        attempt.browser.executed
          ? "Comprovado"
          : "Não comprovado"
      );
    }

    if (attempt.ml?.request) {
      doc.field(
        "ML - Classificação da requisição",
        attempt.ml.request.classification
      );

      if (attempt.ml.request.algorithm) {
        doc.field(
          "Algoritmo utilizado",
          attempt.ml.request.algorithm
        );
      }
    }

    if (attempt.ml?.attack) {
      doc.field(
        "ML - Tipo de entrada",
        attempt.ml.attack.classification
      );
    }

    if (attempt.ml_error) {
      doc.field(
        "Limitação do ML",
        attempt.ml_error
      );
    }

    if (
      attempt.signals &&
      Object.keys(attempt.signals).length > 0
    ) {
      doc.paragraph("Sinais identificados:", 9, true);

      for (
        const [key, value] of Object.entries(
          attempt.signals
        )
      ) {
        doc.field(
          key,
          typeof value === "object"
            ? JSON.stringify(value)
            : value
        );
      }
    }

    doc.paragraph(
      "Interpretação das evidências:",
      9,
      true
    );

    doc.paragraph(attempt.explanation);

    if (attempt.recommendations?.length) {
      doc.paragraph(
        "Recomendações para esta tentativa:",
        9,
        true
      );

      attempt.recommendations.forEach(
        (recommendation, i) => {
          doc.paragraph(
            `${i + 1}. ${recommendation}`
          );
        }
      );
    }
  });

  if (assessment.recommendations?.length) {
    doc.heading(
      `Recomendações gerais - Avaliação ${index}`
    );

    assessment.recommendations.forEach(
      (recommendation, i) => {
        doc.paragraph(
          `${i + 1}. ${recommendation}`
        );
      }
    );
  }
}

// =====================================================
// CONSULTA DE RELATÓRIOS INDIVIDUAIS
// =====================================================

async function fetchAssessment(
  id: string
): Promise<StoredAssessment> {
  const response = await fetch(
    `${API}/security/assessments/${id}`
  );

  const data: unknown = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Avaliação ${id}: HTTP ${response.status}`
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    !("report" in data)
  ) {
    throw new Error(
      `Avaliação ${id}: resposta inválida.`
    );
  }

  return data as StoredAssessment;
}

// =====================================================
// PDF DETALHADO DA VARREDURA COMPLETA
// =====================================================

export async function baixarPdfVarreduraDetalhado(
  scan: ScanForPdf,
  scenarioName: string
): Promise<void> {
  if (scan.status !== "completed") {
    throw new Error(
      "A varredura precisa estar concluída."
    );
  }

  const doc = createPdf(
    "Relatório de varredura completa",
    scenarioName
  );

  const operations = scan.operations || [];

  const references: AssessmentLink[] = [];

  for (const operation of operations) {
    if (operation.sqlInjection?.reportId) {
      references.push({
        id: operation.sqlInjection.reportId,
        attack: "SQLi",
        operation:
          `${operation.method} ${operation.path}`,
      });
    }

    if (operation.xss?.reportId) {
      references.push({
        id: operation.xss.reportId,
        attack: "XSS",
        operation:
          `${operation.method} ${operation.path}`,
      });
    }
  }

  // Busca cada relatório real associado à varredura.
  // Em grupos de quatro para evitar excesso de consultas.
  const uniqueIds = [
    ...new Set(references.map((r) => r.id)),
  ];

  const loaded = new Map<
    string,
    StoredAssessment
  >();

  const failed = new Map<string, string>();

  for (let i = 0; i < uniqueIds.length; i += 4) {
    const batch = uniqueIds.slice(i, i + 4);

    await Promise.all(
      batch.map(async (id) => {
        try {
          const result = await fetchAssessment(id);

          const expectedScenario =
            scan.scenarioId ?? scan.scenario_id;

          if (
            expectedScenario &&
            result.scenario_id !== expectedScenario
          ) {
            throw new Error(
              "A avaliação pertence a outro cenário."
            );
          }

          loaded.set(id, result);
        } catch (error) {
          failed.set(
            id,
            error instanceof Error
              ? error.message
              : "Falha na consulta."
          );
        }
      })
    );
  }

  // ---------------------------------------------------
  // 1. RESUMO EXECUTIVO
  // ---------------------------------------------------

  const confirmedRoutes = new Set<string>();

  let completedTests = 0;
  let verifiedHttp = 0;
  let skippedRoutes = 0;

  for (const operation of operations) {
    if (operation.state === "checked") {
      verifiedHttp++;
    }

    if (operation.state === "skipped") {
      skippedRoutes++;
    }

    if (
      operation.sqlInjection?.state === "completed"
    ) {
      completedTests++;
    }

    if (operation.xss?.state === "completed") {
      completedTests++;
    }

    if (
      operation.sqlInjection?.outcome === "confirmed" ||
      operation.xss?.outcome === "confirmed"
    ) {
      confirmedRoutes.add(
        `${operation.method} ${operation.path}`
      );
    }
  }

  doc.heading("1. Resumo executivo");

  doc.field("ID da varredura", scan.id);

  doc.field(
    "Início",
    date(scan.startedAt ?? scan.started_at)
  );

  doc.field(
    "Término",
    date(scan.finishedAt ?? scan.finished_at)
  );

  doc.field(
    "Operações descobertas",
    scan.total
  );

  doc.field(
    "Operações processadas",
    scan.completed
  );

  doc.field(
    "Operações com HTTP verificado",
    verifiedHttp
  );

  doc.field(
    "Operações não executadas",
    skippedRoutes
  );

  doc.field(
    "Testes SQLi/XSS concluídos",
    completedTests
  );

  doc.field(
    "Rotas com vulnerabilidade demonstrada",
    confirmedRoutes.size
  );

  doc.field(
    "Relatórios individuais recuperados",
    loaded.size
  );

  doc.paragraph(
    "Este documento reúne as verificações HTTP e " +
    "as avaliações de segurança realizadas na " +
    "aplicação local. Resultados suspeitos e " +
    "inconclusivos não são tratados como " +
    "vulnerabilidades comprovadas."
  );

  // ---------------------------------------------------
  // 2. COBERTURA DAS OPERAÇÕES
  // ---------------------------------------------------

  doc.heading("2. Cobertura das operações");

  if (operations.length) {
    doc.table(
      [
        "Operação",
        "HTTP",
        "SQL Injection",
        "XSS",
      ],
      operations.map((operation) => [
        `${operation.method} ${operation.path}`,
        operation.httpStatus === null
          ? "Não requisitada"
          : String(operation.httpStatus),
        testLabel(operation.sqlInjection),
        testLabel(operation.xss),
      ])
    );
  } else {
    doc.paragraph(
      "Nenhuma operação foi registrada nesta varredura."
    );
  }

  // ---------------------------------------------------
  // 3. ROTAS NÃO AVALIADAS OU COM LIMITAÇÕES
  // ---------------------------------------------------

  doc.heading("3. Limitações de cobertura");

  let limitations = 0;

  for (const operation of operations) {
    const notChecked =
      operation.state !== "checked";

    const testsIncomplete =
      operation.sqlInjection.state !== "completed" ||
      operation.xss.state !== "completed";

    if (!notChecked && !testsIncomplete) {
      continue;
    }

    limitations++;

    doc.paragraph(
      `${operation.method} ${operation.path}`,
      10,
      true
    );

    if (operation.explanation) {
      doc.field(
        "Situação HTTP",
        operation.explanation
      );
    }

    if (operation.sqlInjection.state !== "completed") {
      doc.field(
        "SQLi",
        operation.sqlInjection.reason ||
          label(operation.sqlInjection.state)
      );
    }

    if (operation.xss.state !== "completed") {
      doc.field(
        "XSS",
        operation.xss.reason ||
          label(operation.xss.state)
      );
    }
  }

  if (!limitations) {
    doc.paragraph(
      "Nenhuma limitação de cobertura foi registrada."
    );
  }

  // ---------------------------------------------------
  // 4. DETALHAMENTO DE CADA AVALIAÇÃO
  // ---------------------------------------------------

  doc.heading(
    "4. Evidências e tentativas detalhadas"
  );

  if (references.length === 0) {
    doc.paragraph(
      "Esta varredura não contém relatórios " +
      "individuais associados. Não é possível " +
      "apresentar payloads ou evidências detalhadas " +
      "que não tenham sido registradas."
    );
  }

  let assessmentNumber = 0;

  for (const reference of references) {
    const stored = loaded.get(reference.id);

    if (!stored) {
      doc.paragraph(
        `${reference.attack} - ${reference.operation}`,
        10,
        true
      );

      doc.field(
        "Detalhamento indisponível",
        failed.get(reference.id) ||
          "Relatório não encontrado."
      );

      continue;
    }

    assessmentNumber++;

    writeAssessment(
      doc,
      stored.report,
      assessmentNumber
    );
  }

  // ---------------------------------------------------
  // 5. CONSIDERAÇÕES FINAIS
  // ---------------------------------------------------

  doc.heading("5. Considerações finais");

  doc.paragraph(
    "As conclusões apresentadas dependem das " +
    "requisições efetivamente executadas, das " +
    "respostas retornadas e das evidências " +
    "registradas. Um teste não confirmado não " +
    "garante ausência de vulnerabilidade."
  );

  if (failed.size) {
    doc.paragraph(
      `${failed.size} relatório(s) individual(is) ` +
      "não puderam ser recuperados integralmente. " +
      "Nesses casos, consulte os registros no Supabase."
    );
  }

  doc.paragraph(
    "Os registros disponíveis contêm status HTTP, " +
    "sinais de análise e hashes das respostas. " +
    "O corpo completo de uma resposta não pode ser " +
    "reconstruído apenas a partir de seu hash."
  );

  doc.save(
    `WebDetector_Relatorio_${scan.id.slice(0, 8)}.pdf`
  );
}

// =====================================================
// PDF DE UMA ÚNICA AVALIAÇÃO
// =====================================================

export function baixarPdfAvaliacaoDetalhado(
  assessment: AssessmentForPdf,
  scenarioName: string
): void {
  const doc = createPdf(
    "Relatório de avaliação de segurança",
    scenarioName
  );

  writeAssessment(doc, assessment, 1);

  doc.heading("Considerações finais");

  doc.paragraph(
    "Este documento contém os resultados " +
    "registrados para a avaliação selecionada. " +
    "A classificação por Machine Learning é um " +
    "elemento de apoio e não comprova, isoladamente, " +
    "a exploração de uma vulnerabilidade."
  );

  doc.save(
    `WebDetector_${assessment.attackType}_${Date.now()}.pdf`
  );
}
