import { Elysia } from "elysia";
import { handleGetLeaderboard } from "./handlers";

export const leaderboardRoutes = new Elysia({ prefix: "/api" }).get(
  "/leaderboard",
  handleGetLeaderboard,
);