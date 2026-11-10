import { db } from "../database/connection";

export interface SupportTicket {
  id: number;
  clientId: number;
  subject: string;
  message: string;
  status: "ABERTO" | "EM_ANALISE" | "RESOLVIDO";
  createdAt: string;
  clientName?: string;
  clientUsername?: string;
}

const SELECT_TICKETS = `
  SELECT
    t.id,
    t.client_id AS clientId,
    t.subject,
    t.message,
    t.status,
    t.created_at AS createdAt,
    c.full_name AS clientName,
    c.username AS clientUsername
  FROM support_tickets t
  INNER JOIN clients c ON c.id = t.client_id
`;

export class SupportRepository {
  create(clientId: number, subject: string, message: string) {
    const result = db.prepare(`
      INSERT INTO support_tickets (
        client_id,
        subject,
        message
      )
      VALUES (?, ?, ?)
    `).run(clientId, subject, message);

    return this.findById(Number(result.lastInsertRowid));
  }

  findById(id: number): SupportTicket | undefined {
    return db.prepare(`
      ${SELECT_TICKETS}
      WHERE t.id = ?
    `).get(id) as SupportTicket | undefined;
  }

  findByClient(clientId: number): SupportTicket[] {
    return db.prepare(`
      ${SELECT_TICKETS}
      WHERE t.client_id = ?
      ORDER BY t.id DESC
    `).all(clientId) as SupportTicket[];
  }

  findAll(): SupportTicket[] {
    return db.prepare(`
      ${SELECT_TICKETS}
      ORDER BY t.id DESC
      LIMIT 200
    `).all() as SupportTicket[];
  }
}
