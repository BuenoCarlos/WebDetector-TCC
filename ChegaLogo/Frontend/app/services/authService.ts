const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";

export interface LoginDTO {
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user?: AuthUser;
}

export async function login(
  credentials: LoginDTO
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(credentials)
  });

  const data: LoginResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Não foi possível realizar o login."
    );
  }

  return data;
}
