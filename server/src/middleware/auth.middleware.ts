import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import db from "../db";
import { usersTable } from "../db/schema";
import { getUserById } from "../lib/auth";

export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .derive(async ({ headers, jwt }) => {
    const authHeader = headers["authorization"];

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      try {
        const payload = await jwt.verify(token);
        if (payload) {
          const user = await getUserById(payload.userId);
          if (user) {
            return { user };
          }
        }
      } catch {
        // Invalid JWT, continue with API key fallback.
      }
    }

    const apiKeyHeader = headers["x-api-key"];
    if (typeof apiKeyHeader === "string" && apiKeyHeader.trim().length > 0) {
      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.apiKey, apiKeyHeader.trim()),
      });

      if (user) {
        return { user };
      }
    }

    return { user: null };
  })
  .as("plugin");
