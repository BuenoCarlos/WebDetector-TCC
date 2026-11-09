import { db } from "../database/connection";

export interface PublicTracking {
  trackingCode: string;
  origin: string;
  destination: string;
  status: string;
  estimatedDelivery: string;
}

export class TrackingRepository {
  findByTrackingCode(
    trackingCode: string
  ): PublicTracking | undefined {
    const statement = db.prepare(`
      SELECT
        tracking_code AS trackingCode,
        origin,
        destination,
        status,
        estimated_delivery AS estimatedDelivery
      FROM deliveries
      WHERE tracking_code = ?
      LIMIT 1
    `);

    return statement.get(trackingCode) as
      | PublicTracking
      | undefined;
  }
}
