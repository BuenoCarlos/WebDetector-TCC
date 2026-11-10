
const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000/api";

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

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const result = await response.json();

  if (response.status === 401) {
    throw new Error("SESSION_EXPIRED");
  }

  if (!response.ok) {
    throw new Error(
      result.message || "Não foi possível concluir a operação."
    );
  }

  return result.data as T;
}

export function createSupportTicket(data: {
  subject: string;
  message: string;
}) {
  return request<SupportTicket>("/support", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMySupportTickets() {
  return request<SupportTicket[]>("/support/mine");
}

export function getAdminSupportTickets() {
  return request<SupportTicket[]>("/support/admin");
}
