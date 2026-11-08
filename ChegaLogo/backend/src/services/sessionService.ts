
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

export class SessionService {
  createToken(user: SessionUser): string {
    return jwt.sign(
      {
        username: user.username,
        name: user.name,
        role: user.role,
      },
      env.JWT_SECRET,
      {
        subject: user.id,
        expiresIn: "2h",
        issuer: "chegalogo",
        audience: "chegalogo-web",
        algorithm: "HS256",
      }
    );
  }

  verifyToken(token: string): SessionUser | null {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET, {
        issuer: "chegalogo",
        audience: "chegalogo-web",
        algorithms: ["HS256"],
      });

      if (typeof payload === "string") {
        return null;
      }

      const data = payload as JwtPayload;

      if (
        typeof data.sub !== "string" ||
        typeof data.username !== "string" ||
        typeof data.name !== "string" ||
        typeof data.role !== "string"
      ) {
        return null;
      }

      return {
        id: data.sub,
        username: data.username,
        name: data.name,
        role: data.role,
      };
    } catch {
      return null;
    }
  }
}
