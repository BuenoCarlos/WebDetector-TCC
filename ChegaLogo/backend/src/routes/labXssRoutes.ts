import { Router, type Request, type Response } from "express";

const router = Router();

// Armazenamento temporário, sem banco de dados.
let storedMessage = "";

function getMessage(req: Request): string | null {
  const value =
    req.method === "GET"
      ? req.query.message
      : req.body?.message;

  if (typeof value !== "string" || value.length > 2000) {
    return null;
  }

  return value;
}

function sendHtml(res: Response, html: string) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).type("html").send(html);
}


function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlPage(content: string): string {
  const protectedMode =
    process.env.WD_LAB_PROTECTED !== "0";

  const displayedContent = protectedMode
    ? escapeHtml(content)
    : content;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>ChegaLogo - Laboratório XSS</title>
</head>
<body>
  <h1>Laboratório XSS - ChegaLogo</h1>
  <p>Conteúdo de demonstração:</p>

  <div id="resultado">${displayedContent}</div>
</body>
</html>`;
}

// Bloqueia acesso remoto e execução fora do laboratório.
router.use((req, res, next) => {
  const address = req.socket.remoteAddress || "";

  const local = [
    "127.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
  ].includes(address);

  if (
    !local ||
    process.env.NODE_ENV !== "development" ||
    process.env.WD_ENABLE_XSS_LAB !== "1"
  ) {
    res.status(403).send("Laboratório indisponível.");
    return;
  }

  next();
});

// 1. REFLETIDO - GET
router.get("/xss/reflected", (req, res) => {
  const message = getMessage(req);

  if (message === null) {
    res.status(400).send("Mensagem inválida.");
    return;
  }

  // Vulnerabilidade intencional: saída não escapada.
  sendHtml(res, htmlPage(message));
});

// 2. REFLETIDO - POST JSON
router.post("/xss/reflected", (req, res) => {
  const message = getMessage(req);

  if (message === null) {
    res.status(400).send("Mensagem inválida.");
    return;
  }

  sendHtml(res, htmlPage(message));
});

// 3. ARMAZENADO - POST JSON
router.post("/xss/stored", (req, res) => {
  const message = getMessage(req);

  if (message === null) {
    res.status(400).json({ success: false });
    return;
  }

  // Armazena somente em memória.
  storedMessage = message;

  res.json({
    success: true,
    saved: true,
  });
});

// 4. ARMAZENADO - GET
router.get("/xss/stored", (_req, res) => {
  // Renderiza conteúdo previamente armazenado.
  sendHtml(res, htmlPage(storedMessage));
});

// 5. BASEADO EM DOM - GET
router.get("/xss/dom", (_req, res) => {
  const protectedMode =
    process.env.WD_LAB_PROTECTED !== "0";

  const property = protectedMode
    ? "textContent"
    : "innerHTML";

  sendHtml(
    res,
    `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>ChegaLogo - Laboratório DOM XSS</title>
</head>
<body>
  <h1>Laboratório DOM XSS</h1>

  <div id="resultado"></div>

  <script>
    const params = new URLSearchParams(location.search);
    const message = params.get("message") || "";

    document.getElementById("resultado").${property} = message;
  </script>
</body>
</html>`
  );
});

export default router;