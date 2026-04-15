import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  handleCreateMarket,
  handleListMarkets,
  handleGetMarket,
  handlePlaceBet,
  handleResolveMarket,
  handleArchiveMarket,
  handleGenerateApiKey,
  handleGetUserProfile,
} from "./handlers";

export const marketRoutes = new Elysia({ prefix: "/api/markets" })
  .use(authMiddleware)
  .get("/", handleListMarkets, {
    query: t.Object({
      status: t.Optional(t.String()),
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
    }),
  })
  .get("/:id", handleGetMarket, {
    params: t.Object({
      id: t.String(),
    }),
  })
  .guard(
    {
      beforeHandle({ user, set }) {
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      },
    },
    (app) =>
      app
        .get("/profile", handleGetUserProfile, {
          query: t.Object({
            activePage: t.Optional(t.Numeric()),
            resolvedPage: t.Optional(t.Numeric()),
          }),
        })
        .post("/generate-api-key", handleGenerateApiKey)
        .post("/", handleCreateMarket, {
          body: t.Object({
            title: t.String(),
            description: t.Optional(t.String()),
            outcomes: t.Array(t.String()),
          }),
        })
        .post("/:id/bets", handlePlaceBet, {
          params: t.Object({
            id: t.String(),
          }),
          body: t.Object({
            outcomeId: t.Number(),
            amount: t.Number(),
          }),
        })
        .post("/:id/resolve", handleResolveMarket, {
          params: t.Object({
            id: t.String(),
          }),
          body: t.Object({
            outcomeId: t.Number(),
          }),
        })
        .post("/:id/archive", handleArchiveMarket, {
          params: t.Object({
            id: t.Numeric(),
          }),
        }),
  );
