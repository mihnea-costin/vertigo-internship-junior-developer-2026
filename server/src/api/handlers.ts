import { eq } from "drizzle-orm";
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

export async function handleRegister({
  body,
  jwt,
  set,
}: {
  body: { username: string; email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { username, email, password } = body;
  const errors = validateRegistration(username, email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { or, eq }) => or(eq(users.email, email), eq(users.username, username)),
  });

  if (existingUser) {
    set.status = 409;
    return { errors: [{ field: "email", message: "User already exists" }] };
  }

  const passwordHash = await hashPassword(password);

  const newUser = await db.insert(usersTable).values({ username, email, passwordHash }).returning();

  const token = await jwt.sign({ userId: newUser[0].id });

  set.status = 201;
  return {
    id: newUser[0].id,
    username: newUser[0].username,
    email: newUser[0].email,
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
  set: { status: number };
}) {
  const { email, password } = body;
  const errors = validateLogin(email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    set.status = 401;
    return { error: "Invalid email or password" };
  }

  const token = await jwt.sign({ userId: user.id });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    token,
  };
}

export async function handleCreateMarket({
  body,
  set,
  user,
}: {
  body: { title: string; description?: string; outcomes: string[] };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
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

  const outcomeIds = await db
    .insert(marketOutcomesTable)
    .values(
      outcomes.map((title: string, index: number) => ({
        marketId: market[0].id,
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

export async function handleListMarkets({ query }: { query: { status?: string } }) {
  const statusFilter = query.status || "active";

  const markets = await db.query.marketsTable.findMany({
    where: eq(marketsTable.status, statusFilter),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  const enrichedMarkets = await Promise.all(
    markets.map(async (market) => {
      const betsPerOutcome = await Promise.all(
        market.outcomes.map(async (outcome) => {
          const totalBets = await db
            .select()
            .from(betsTable)
            .where(eq(betsTable.outcomeId, outcome.id));

          const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);
          return { outcomeId: outcome.id, totalBets: totalAmount };
        }),
      );

      const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);

      return {
        id: market.id,
        title: market.title,
        status: market.status,
        creator: market.creator?.username,
        outcomes: market.outcomes.map((outcome) => {
          const outcomeBets =
            betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
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
    }),
  );

  return enrichedMarkets;
}

export async function handleGetMarket({
  params,
  set,
}: {
  params: { id: string };
  set: { status: number };
}) {
  const market = await db.query.marketsTable.findFirst({
    where: (markets: typeof marketsTable, { eq }) => eq(markets.id, params.id),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  const betsPerOutcome = await Promise.all(
    market.outcomes.map(async (outcome) => {
      const totalBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.outcomeId, outcome.id));

      const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);
      return { outcomeId: outcome.id, totalBets: totalAmount };
    }),
  );

  const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);

  return {
    id: market.id,
    title: market.title,
    description: market.description,
    status: market.status,
    creator: market.creator?.username,
    outcomes: market.outcomes.map((outcome) => {
      const outcomeBets = betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
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
