
const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000/api";

export interface TrackingResult {
  trackingCode: string;
  origin: string;
  destination: string;
  status: "PENDENTE" | "EM_TRANSITO" | "ENTREGUE" | "ATRASADA";
  estimatedDelivery: string;
}

export async function trackDelivery(
  code: string
): Promise<TrackingResult> {
  const response = await fetch(
    `${API_URL}/tracking/${encodeURIComponent(code.trim())}`
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Não foi possível rastrear a encomenda."
    );
  }

  return result.data;
}
