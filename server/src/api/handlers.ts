import { asc, desc, eq, inArray, or } from "drizzle-orm";
import db from "../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../db/schema";
import { hashPassword, verifyPassword, type AuthTokenPayload } from "../lib/auth";
import {
  validateRegistration,
  validateLogin,
  validateMarketCreation,
} from "../lib/validation";

type JwtSigner = {
  sign: (payload: AuthTokenPayload) => Promise<string>;
};

type ResponseSet = {
  status?: number | string;
};

export async function handleRegister({
  body,
  jwt,
  set,
}: {
  body: { username: string; email: string; password: string };
  jwt: JwtSigner;
  set: ResponseSet;
}) {
  const { username, email, password } = body;
  const errors = validateRegistration(username, email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const existingUser = await db.select().from(usersTable).where(
    (users) => or(eq(users.email, email), eq(users.username, username))
  ).limit(1);
  const user = existingUser[0] ?? null;

  if (user) {
    set.status = 409;
    return { errors: [{ field: "email", message: "User already exists" }] };
  }

  const passwordHash = await hashPassword(password);

  const newUser = await db.insert(usersTable).values({ username, email, passwordHash }).returning();

  if (!newUser[0]) {
    set.status = 500;
    return { errors: [{ field: "server", message: "Failed to create user" }] };
  }

  const token = await jwt.sign({ userId: newUser[0].id });

  set.status = 201;
  return {
    id: newUser[0].id,
    username: newUser[0].username,
    email: newUser[0].email,
    role: newUser[0].role,
    balance: newUser[0].balance,
    token,
  };
}

export async function handleLogin({
  body,
  jwt,
  set,
}: {
  body: { email: string; password: string };
  jwt: JwtSigner;
  set: ResponseSet;
}) {
  const { email, password } = body;
  const errors = validateLogin(email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = users[0] ?? null;

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    set.status = 401;
    return { error: "Invalid email or password" };
  }

  const token = await jwt.sign({ userId: user.id });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    balance: user.balance,
    token,
  };
}

export async function handleCreateMarket({
  body,
  set,
  user,
}: {
  body: { title: string; description?: string; outcomes: string[] };
  set: ResponseSet;
  user: typeof usersTable.$inferSelect | null;
}) {
  if (!user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const { title, description, outcomes } = body;
  const errors = validateMarketCreation(title, description || "", outcomes);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db
    .insert(marketsTable)
    .values({
      title,
      description: description || null,
      createdBy: user.id,
    })
    .returning();

  if (!market[0]) {
    set.status = 500;
    return { errors: ["Failed to create market"] };
  }

  const outcomeIds = await db
    .insert(marketOutcomesTable)
    .values(
      outcomes.map((title: string, index: number) => ({
        marketId: market[0]!.id,
        title,
        position: index,
      })),
    )
    .returning();

  set.status = 201;
  return {
    id: market[0].id,
    title: market[0].title,
    description: market[0].description,
    status: market[0].status,
    outcomes: outcomeIds,
  };
}

export async function handleListMarkets({ query }: { query: { status?: string; page?: string; limit?: string } }) {
  const requestedStatus = query.status;
  const statusFilter: typeof marketsTable.$inferSelect.status =
    requestedStatus === "active" || requestedStatus === "resolved" || requestedStatus === "archived"
      ? requestedStatus
      : "active";

  const page = Math.max(1, Number(query?.page ?? 1));
  const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 10)));

  const marketRows = await db
    .select({
      id: marketsTable.id,
      title: marketsTable.title,
      status: marketsTable.status,
      creatorUsername: usersTable.username,
    })
    .from(marketsTable)
    .leftJoin(usersTable, eq(usersTable.id, marketsTable.createdBy))
    .where(eq(marketsTable.status, statusFilter));

  if (marketRows.length === 0) {
    return {
      data: [],
      pagination: {
        page,
        pageSize: limit,
        total: 0,
        hasMore: false,
      },
    };
  }

  const marketIds = marketRows.map((market) => market.id);

  const outcomeRows = await db
    .select({
      id: marketOutcomesTable.id,
      marketId: marketOutcomesTable.marketId,
      title: marketOutcomesTable.title,
      position: marketOutcomesTable.position,
    })
    .from(marketOutcomesTable)
    .where(inArray(marketOutcomesTable.marketId, marketIds))
    .orderBy(asc(marketOutcomesTable.position));

  const betRows = await db
    .select({
      marketId: betsTable.marketId,
      outcomeId: betsTable.outcomeId,
      amount: betsTable.amount,
    })
    .from(betsTable)
    .where(inArray(betsTable.marketId, marketIds));

  const outcomeTotals = new Map<number, number>();
  for (const bet of betRows) {
    outcomeTotals.set(bet.outcomeId, (outcomeTotals.get(bet.outcomeId) ?? 0) + bet.amount);
  }

  const outcomesByMarket = new Map<number, typeof outcomeRows>();
  for (const outcome of outcomeRows) {
    const existing = outcomesByMarket.get(outcome.marketId) ?? [];
    existing.push(outcome);
    outcomesByMarket.set(outcome.marketId, existing);
  }

  const enrichedMarkets = marketRows.map((market) => {
    const outcomes = outcomesByMarket.get(market.id) ?? [];
    const totalMarketBets = outcomes.reduce(
      (sum, outcome) => sum + (outcomeTotals.get(outcome.id) ?? 0),
      0,
    );

    return {
      id: market.id,
      title: market.title,
      status: market.status,
      creator: market.creatorUsername,
      outcomes: outcomes.map((outcome) => {
        const outcomeBets = outcomeTotals.get(outcome.id) ?? 0;
        const odds = totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

        return {
          id: outcome.id,
          title: outcome.title,
          odds,
          totalBets: outcomeBets,
        };
      }),
      totalMarketBets,
    };
  });

  const start = (page - 1) * limit;
  const paginatedMarkets = enrichedMarkets.slice(start, start + limit);

  return {
    data: paginatedMarkets,
    pagination: {
      page,
      pageSize: limit,
      total: enrichedMarkets.length,
      hasMore: page * limit < enrichedMarkets.length,
    },
  };
}

export async function handleGetMarket({
  params,
  set,
}: {
  params: { id: string };
  set: ResponseSet;
}) {
  const marketId = Number(params.id);
  if (!Number.isInteger(marketId)) {
    set.status = 400;
    return { error: "Invalid market id" };
  }

  const [market] = await db
    .select({
      id: marketsTable.id,
      title: marketsTable.title,
      description: marketsTable.description,
      status: marketsTable.status,
      creatorUsername: usersTable.username,
    })
    .from(marketsTable)
    .leftJoin(usersTable, eq(usersTable.id, marketsTable.createdBy))
    .where(eq(marketsTable.id, marketId))
    .limit(1);

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  const outcomes = await db
    .select({
      id: marketOutcomesTable.id,
      title: marketOutcomesTable.title,
      position: marketOutcomesTable.position,
    })
    .from(marketOutcomesTable)
    .where(eq(marketOutcomesTable.marketId, marketId))
    .orderBy(asc(marketOutcomesTable.position));

  const bets = await db
    .select({
      outcomeId: betsTable.outcomeId,
      amount: betsTable.amount,
    })
    .from(betsTable)
    .where(eq(betsTable.marketId, marketId));

  const outcomeTotals = new Map<number, number>();
  for (const bet of bets) {
    outcomeTotals.set(bet.outcomeId, (outcomeTotals.get(bet.outcomeId) ?? 0) + bet.amount);
  }

  const totalMarketBets = outcomes.reduce(
    (sum, outcome) => sum + (outcomeTotals.get(outcome.id) ?? 0),
    0,
  );

  return {
    id: market.id,
    title: market.title,
    description: market.description,
    status: market.status,
    creator: market.creatorUsername,
    outcomes: outcomes.map((outcome) => {
      const outcomeBets = outcomeTotals.get(outcome.id) ?? 0;
      const odds =
        totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

      return {
        id: outcome.id,
        title: outcome.title,
        odds,
        totalBets: outcomeBets,
      };
    }),
    totalMarketBets,
  };
}

export const handlePlaceBet = async ({
  params,
  body,
  user,
  set,
}: any) => {
  // 1. Validare: Suma trebuie să fie mai mare decât 0
  if (body.amount <= 0) {
    set.status = 400;
    return { error: "Bet amount must be positive" };
  }

  try {
    // 2. Tranzacție: executăm ambele operațiuni împreună
    const result = await db.transaction(async (tx) => {
      // Aducem datele utilizatorului pentru a verifica balanța
      const [currentUser] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, user.id));

      if (!currentUser || currentUser.balance < body.amount) {
        throw new Error("Insufficient balance");
      }

      // Inserăm pariul
      const [newBet] = await tx
        .insert(betsTable)
        .values({
          userId: user.id,
          marketId: params.id,
          outcomeId: body.outcomeId,
          amount: body.amount,
        })
        .returning();

      // Scădem suma din balanța utilizatorului
      await tx
        .update(usersTable)
        .set({ balance: currentUser.balance - body.amount })
        .where(eq(usersTable.id, user.id));

      return newBet;
    });

    return { message: "Bet placed successfully", bet: result };
  } catch (error: any) {
    if (error.message === "Insufficient balance") {
      set.status = 400;
      return { error: "Insufficient balance" };
    }
    console.error(error);
    set.status = 500;
    return { error: "Failed to place bet" };
  }
};

export const handleResolveMarket = async ({
  params,
  body,
  user,
  set,
}: any) => {
  // 1. Verificăm dacă user-ul este Admin
  const [currentUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, user.id));

  if (!currentUser || currentUser.role !== "admin") {
    set.status = 403;
    return { error: "Only admins can resolve markets" };
  }

  const marketId = Number(params.id);
  const winningOutcomeId = Number(body.outcomeId);

  try {
    await db.transaction(async (tx) => {
      // 2. Marcăm marketul ca fiind rezolvat
      await tx
        .update(marketsTable)
        .set({
          status: "resolved",
          resolvedOutcomeId: winningOutcomeId,
        })
        .where(eq(marketsTable.id, marketId));

      // 3. Aducem toate pariurile pentru acest market
      const allBets = await tx
        .select()
        .from(betsTable)
        .where(eq(betsTable.marketId, marketId));

      // 4. Calculăm totalul banilor pariați (pool-ul)
      const totalPool = allBets.reduce((sum, bet) => sum + bet.amount, 0);

      // 5. Găsim pariurile câștigătoare
      const winningBets = allBets.filter(bet => bet.outcomeId === winningOutcomeId);
      const winningPool = winningBets.reduce((sum, bet) => sum + bet.amount, 0);

      // 6. Distribuim câștigurile (dacă a câștigat cineva)
      if (winningPool > 0) {
        for (const bet of winningBets) {
          // Calculăm cota parte a utilizatorului din câștig
          const userShare = bet.amount / winningPool;
          const userWinnings = totalPool * userShare;

          // Aducem balanța curentă a câștigătorului
          const [winner] = await tx
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, bet.userId));

          if (winner) {
            // Îi dăm banii
            await tx
              .update(usersTable)
              .set({ balance: winner.balance + userWinnings })
              .where(eq(usersTable.id, winner.id));
          }
        }
      }
    });

    return { message: "Market resolved and funds distributed successfully" };
  } catch (error) {
    console.error(error);
    set.status = 500;
    return { error: "Failed to resolve market" };
  }
};

export const handleArchiveMarket = async ({ params, user, set }: any) => {
  if (!user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const [currentUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, user.id));

  if (!currentUser || currentUser.role !== "admin") {
    set.status = 403;
    return { error: "Only admins can archive markets" };
  }

  const marketId = Number(params.id);
  if (!Number.isInteger(marketId)) {
    set.status = 400;
    return { error: "Invalid market id" };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(marketsTable)
        .set({ status: "archived" })
        .where(eq(marketsTable.id, marketId));

      const bets = await tx
        .select()
        .from(betsTable)
        .where(eq(betsTable.marketId, marketId));

      for (const bet of bets) {
        const [bettor] = await tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, bet.userId));

        if (bettor) {
          await tx
            .update(usersTable)
            .set({ balance: bettor.balance + bet.amount })
            .where(eq(usersTable.id, bettor.id));
        }
      }
    });

    return { message: "Market archived and refunds processed successfully" };
  } catch (error) {
    console.error(error);
    set.status = 500;
    return { error: "Failed to archive market" };
  }
};

export const handleGenerateApiKey = async ({ user, set }: any) => {
  if (!user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const apiKey = crypto.randomUUID();

  const [updatedUser] = await db
    .update(usersTable)
    .set({ apiKey })
    .where(eq(usersTable.id, user.id))
    .returning();

  if (!updatedUser) {
    set.status = 500;
    return { error: "Failed to generate API key" };
  }

  return { apiKey };
};

export const handleGetUserProfile = async ({ user, query, set }: any) => {
  if (!user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const activePage = Math.max(1, Number(query?.activePage ?? 1));
  const resolvedPage = Math.max(1, Number(query?.resolvedPage ?? 1));
  const pageSize = 20;

  const [currentUser] = await db
    .select({
      balance: usersTable.balance,
      apiKey: usersTable.apiKey,
    })
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .limit(1);

  if (!currentUser) {
    set.status = 404;
    return { error: "User not found" };
  }

  const betRows = await db
    .select({
      id: betsTable.id,
      outcomeId: betsTable.outcomeId,
      amount: betsTable.amount,
      createdAt: betsTable.createdAt,
      market: {
        id: marketsTable.id,
        title: marketsTable.title,
        status: marketsTable.status,
        resolvedOutcomeId: marketsTable.resolvedOutcomeId,
      },
      outcome: {
        id: marketOutcomesTable.id,
        title: marketOutcomesTable.title,
      },
    })
    .from(betsTable)
    .innerJoin(marketsTable, eq(marketsTable.id, betsTable.marketId))
    .innerJoin(marketOutcomesTable, eq(marketOutcomesTable.id, betsTable.outcomeId))
    .where(eq(betsTable.userId, user.id))
    .orderBy(desc(betsTable.createdAt));

  const activeBetsAll = betRows.filter((bet) => bet.market.status === "active");
  const resolvedBetsAll = betRows.filter((bet) => bet.market.status === "resolved");

  const activeStart = (activePage - 1) * pageSize;
  const resolvedStart = (resolvedPage - 1) * pageSize;

  const activeBets = activeBetsAll.slice(activeStart, activeStart + pageSize);
  const resolvedBets = resolvedBetsAll.slice(resolvedStart, resolvedStart + pageSize);

  return {
    balance: currentUser.balance,
    apiKey: currentUser.apiKey,
    activeBets,
    resolvedBets,
    pagination: {
      active: {
        page: activePage,
        pageSize,
        total: activeBetsAll.length,
      },
      resolved: {
        page: resolvedPage,
        pageSize,
        total: resolvedBetsAll.length,
      },
    },
  };
};

