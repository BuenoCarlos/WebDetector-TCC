
const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000/api";

export type DeliveryStatus =
  | "PENDENTE"
  | "EM_TRANSITO"
  | "ENTREGUE"
  | "ATRASADA";

export interface Delivery {
  id: number;
  trackingCode: string;
  recipient: string;
  origin: string;
  destination: string;
  driver: string;
  status: DeliveryStatus;
  estimatedDelivery: string;
  createdAt: string;
  observations: string;
}

export interface DeliverySummary {
  totalDeliveries: number;
  pending: number;
  inTransit: number;
  delivered: number;
  delayed: number;
  activeDrivers: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
  });

  if (response.status === 401) {
    throw new Error("SESSION_EXPIRED");
  }

  if (!response.ok) {
    throw new Error("Não foi possível carregar os dados.");
  }

  const result: ApiResponse<T> = await response.json();
  return result.data;
}

export function getDeliveries(search = "") {
  const params = new URLSearchParams();

  if (search.trim()) {
    params.set("search", search.trim());
  }

  const query = params.toString();

  return apiGet<Delivery[]>(
    `/deliveries${query ? `?${query}` : ""}`
  );
}

export function getDeliverySummary() {
  return apiGet<DeliverySummary>("/deliveries/summary");
}
