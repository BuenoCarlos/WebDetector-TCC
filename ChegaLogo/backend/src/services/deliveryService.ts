
import { DeliveryRepository } from "../repositories/deliveryRepository";

export class DeliveryService {
  private repository = new DeliveryRepository();

  // Lista todas as entregas ou pesquisa pelo termo informado
  listDeliveries(search?: string) {
    if (!search?.trim()) {
      return this.repository.findAll();
    }

    return this.repository.search(search.trim());
  }

  // Busca uma entrega pelo ID
  getDelivery(id: number) {
    return this.repository.findById(id);
  }

  // Retorna os indicadores do Dashboard
  getSummary() {
    const deliveries = this.repository.findAll();

    return {
      totalDeliveries: deliveries.length,

      pending: deliveries.filter(
        (item) => item.status === "PENDENTE"
      ).length,

      inTransit: deliveries.filter(
        (item) => item.status === "EM_TRANSITO"
      ).length,

      delivered: deliveries.filter(
        (item) => item.status === "ENTREGUE"
      ).length,

      delayed: deliveries.filter(
        (item) => item.status === "ATRASADA"
      ).length,

      activeDrivers: new Set(
        deliveries
          .filter((item) => item.status === "EM_TRANSITO")
          .map((item) => item.driver)
      ).size,
    };
  }
}
