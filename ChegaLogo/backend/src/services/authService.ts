import bcrypt from "bcryptjs";

export class AuthService {
  async login(username: string, password: string) {
    const expectedUsername = process.env.DEMO_USERNAME;
    const passwordHash = process.env.DEMO_PASSWORD_HASH;

    if (!expectedUsername || !passwordHash) {
      throw new Error("Usuário de demonstração não configurado.");
    }

    const usernameMatches = username === expectedUsername;
    const passwordMatches = await bcrypt.compare(
      password,
      passwordHash
    );

    if (!usernameMatches || !passwordMatches) {
      return null;
    }

    return {
      id: "demo-admin",
      username: expectedUsername,
      name: "Administrador ChegaLogo",
      role: "admin"
    };
  }
}
