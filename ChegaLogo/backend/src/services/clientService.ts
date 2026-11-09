import bcrypt from "bcryptjs";
import { ClientRepository } from "../repositories/clientRepository";

export interface RegisterClientData {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
}

export class ClientService {
  private repository = new ClientRepository();

  async register(data: RegisterClientData) {
    const username = data.username.trim().toLowerCase();
    const email = data.email.trim().toLowerCase();

    const adminUsername =
      process.env.DEMO_USERNAME?.trim().toLowerCase();

    if (
      username === adminUsername ||
      this.repository.exists(username, email)
    ) {
      throw new Error("CLIENT_ALREADY_EXISTS");
    }

    const passwordHash = await bcrypt.hash(
      data.password,
      12
    );

    try {
      return this.repository.create({
        fullName: data.fullName.trim(),
        username,
        email,
        phone: data.phone?.trim() || null,
        passwordHash,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed")
      ) {
        throw new Error("CLIENT_ALREADY_EXISTS");
      }

      throw error;
    }
  }

  async login(username: string, password: string) {
    const client = this.repository.findByUsername(
      username.trim().toLowerCase()
    );

    if (!client) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(
      password,
      client.passwordHash
    );

    if (!passwordMatches) {
      return null;
    }

    return {
      id: String(client.id),
      username: client.username,
      name: client.fullName,
      role: "client",
    };
  }
}
