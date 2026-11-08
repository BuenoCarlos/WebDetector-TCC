
import { db } from "./connection";
import { deliveries } from "../data/deliveries";

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_code TEXT NOT NULL UNIQUE,
      recipient TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      driver TEXT NOT NULL,
      status TEXT NOT NULL CHECK (
        status IN (
          'PENDENTE',
          'EM_TRANSITO',
          'ENTREGUE',
          'ATRASADA'
        )
      ),
      estimated_delivery TEXT NOT NULL,
      created_at TEXT NOT NULL,
      observations TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_deliveries_tracking
      ON deliveries(tracking_code);

    CREATE INDEX IF NOT EXISTS idx_deliveries_status
      ON deliveries(status);
  `);

  const result = db.prepare(
    "SELECT COUNT(*) AS total FROM deliveries"
  ).get() as { total: number };

  if (result.total === 0) {
    const insert = db.prepare(`
      INSERT INTO deliveries (
        id,
        tracking_code,
        recipient,
        origin,
        destination,
        driver,
        status,
        estimated_delivery,
        created_at,
        observations
      )
      VALUES (
        @id,
        @trackingCode,
        @recipient,
        @origin,
        @destination,
        @driver,
        @status,
        @estimatedDelivery,
        @createdAt,
        @observations
      )
    `);

    const insertInitialData = db.transaction(() => {
      for (const delivery of deliveries) {
        insert.run(delivery);
      }
    });

    insertInitialData();

    console.log(
      `${deliveries.length} entregas fictícias cadastradas.`
    );
  }

  console.log("Banco de dados inicializado.");
}
