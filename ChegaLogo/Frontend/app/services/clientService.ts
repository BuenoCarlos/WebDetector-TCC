const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000/api";

export interface RegisterClientDTO {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
}

export async function registerClient(
  data: RegisterClientDTO
): Promise<void> {
  const response = await fetch(`${API_URL}/clients/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Não foi possível criar sua conta."
    );
  }
}
