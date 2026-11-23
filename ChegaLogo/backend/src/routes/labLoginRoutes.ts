import { Router } from "express";
import Database from "better-sqlite3";

const router = Router();

const labDb = new Database(":memory:");

labDb.exec(`
  CREATE TABLE lab_users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL
  );

  INSERT INTO lab_users (username, password)
  VALUES ('usuario_demo', 'senha_demo_123'),
         ('admin', 'Teste@123'),
         ('financeiro', '123456'),
         ('comercial', '123');
`);

/**
 * @openapi
 * /api/lab/login:
 *   post:
 *     summary: Login vulnerável de laboratório
 *     description: |
 *       Endpoint fictício utilizado para avaliar a
 *       detecção e exploração de SQL Injection.
 *       Não utiliza contas reais da aplicação.
 *     tags:
 *       - Laboratório de Segurança
 *
 
 *     x-webdetector-safe-to-test: true
 *     x-webdetector-test:
 *       kind: authentication
 *       baseline:
 *         username: webdetector_inexistente
 *         password: SenhaInvalida_LAB_2026
 *       auth:
 *         confirmation_mode: response
 *         success_fields:
 *           - success
 *           - lab_authenticated
 *         identity_fields:
 *           - users
 *         session_cookie_names: []

 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Campo utilizado nos testes de SQL Injection
 *                 example: usuario_demo
 *               password:
 *                 type: string
 *                 format: password
 *                 example: senha_invalida
 *
 *     responses:
 *       200:
 *         description: Autenticação fictícia realizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 lab_authenticated:
 *                   type: boolean
 *                   example: true
 *                 total:
 *                   type: integer
 *                   example: 3
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       username:
 *                         type: string
 *
 *       400:
 *         description: Erro nos campos ou na consulta SQL
 *
 *       401:
 *         description: Credenciais inválidas
 *
 *       404:
 *         description: Endpoint indisponível em produção
 */

router.post("/login", (req, res) => {
  const remote = req.socket.remoteAddress || "";

  const local = [
    "127.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
  ].includes(remote);

  if (
    process.env.NODE_ENV !== "development" ||
    !local
  ) {
    return res.status(404).json({
      success: false,
      message: "Laboratório indisponível",
    });
  }

  const { username, password } = req.body ?? {};

  if (
    typeof username !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      success: false,
      message: "Usuário e senha obrigatórios",
    });
  }

  const vulnerableMode =
    process.env.WD_LAB_PROTECTED === "0";

  try {
    let users: {
      id: number;
      username: string;
    }[];

    if (vulnerableMode) {
      // Apenas no laboratório intencionalmente vulnerável.
      const query = `
        SELECT id, username
        FROM lab_users
        WHERE username = '${username}'
        AND password = '${password}'
      `;

      users = labDb.prepare(query).all() as typeof users;
    } else {
      // Modo protegido: consulta parametrizada.
      const query = `
        SELECT id, username
        FROM lab_users
        WHERE username = ?
        AND password = ?
      `;

      users = labDb
        .prepare(query)
        .all(username, password) as typeof users;
    }

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Credenciais inválidas",
      });
    }

    return res.status(200).json({
      success: true,
      lab_authenticated: true,
      message: "Autenticação de laboratório realizada",
      total: users.length,
      users,
    });
  } catch {
    return res.status(400).json({
      success: false,
      message: "Erro na consulta de autenticação",
    });
  }
});


export default router;
