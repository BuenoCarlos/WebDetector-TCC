
import { db } from "../database/connection";

export interface SecurityEventInput {
  eventType: string;
  requestMethod: string;
  requestPath: string;
  inputLength: number;
  responseStatus: number;
  durationMs: number;
}

export class SecurityEventRepository {
  create(event: SecurityEventInput) {
    const statement = db.prepare(`
      INSERT INTO security_events (
        event_type,
        request_method,
        request_path,
        input_length,
        response_status,
        duration_ms
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    return statement.run(
      event.eventType,
      event.requestMethod,
      event.requestPath,
      event.inputLength,
      event.responseStatus,
      event.durationMs
    );
  }

  findAll() {
    return db.prepare(`
      SELECT *
      FROM security_events
      ORDER BY id DESC
      LIMIT 100
    `).all();
  }
}
