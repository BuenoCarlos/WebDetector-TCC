
import { db } from "../database/connection";
import type { Delivery } from "../data/deliveries";

const SELECT_DELIVERIES = `
  SELECT
    id,
    tracking_code AS trackingCode,
    recipient,
    origin,
    destination,
    driver,
    status,
    estimated_delivery AS estimatedDelivery,
    created_at AS createdAt,
    observations
  FROM deliveries
`;

export class DeliveryRepository {
  findAll(): Delivery[] {
    const statement = db.prepare(`
      ${SELECT_DELIVERIES}
      ORDER BY id ASC
    `);

    return statement.all() as Delivery[];
  }

  findById(id: number): Delivery | undefined {
    const statement = db.prepare(`
      ${SELECT_DELIVERIES}
      WHERE id = ?
    `);

    return statement.get(id) as Delivery | undefined;
  }

  search(term: string): Delivery[] {
    const statement = db.prepare(`
      ${SELECT_DELIVERIES}
      WHERE tracking_code LIKE @term
         OR recipient LIKE @term
         OR origin LIKE @term
         OR destination LIKE @term
      ORDER BY id ASC
    `);

    return statement.all({
      term: `%${term}%`
    }) as Delivery[];
  }
}
