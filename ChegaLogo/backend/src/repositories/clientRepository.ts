import { db } from "../database/connection";

export interface CreateClientData {
  fullName: string;
  username: string;
  email: string;
  phone: string | null;
  passwordHash: string;
}

export class ClientRepository {
  exists(username: string, email: string): boolean {
    const result = db.prepare(`
      SELECT id
      FROM clients
      WHERE username = ? OR email = ?
      LIMIT 1
    `).get(username, email);

    return Boolean(result);
  }

  create(data: CreateClientData) {
    const result = db.prepare(`
      INSERT INTO clients (
        full_name,
        username,
        email,
        phone,
        password_hash
      )
      VALUES (
        @fullName,
        @username,
        @email,
        @phone,
        @passwordHash
      )
    `).run(data);

    return db.prepare(`
      SELECT
        id,
        full_name AS fullName,
        username,
        email,
        phone,
        created_at AS createdAt
      FROM clients
      WHERE id = ?
    `).get(result.lastInsertRowid);
  }


findByUsername(username: string) {
  return db.prepare(`
    SELECT
      id,
      full_name AS fullName,
      username,
      email,
      password_hash AS passwordHash
    FROM clients
    WHERE username = ?
    LIMIT 1
  `).get(username) as {
    id: number;
    fullName: string;
    username: string;
    email: string;
    passwordHash: string;
  } | undefined;
}

}
