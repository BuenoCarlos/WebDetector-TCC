import { TrackingRepository } from "../repositories/trackingRepository";

export class TrackingService {
  private repository = new TrackingRepository();

  track(trackingCode: string) {
    return this.repository.findByTrackingCode(
      trackingCode.trim().toUpperCase()
    );
  }
}
