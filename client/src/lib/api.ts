const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";

// Types
export interface Market {
  id: number;
  title: string;
  description?: string;
  status: "active" | "resolved" | "archived";
  creator?: string;
  outcomes: Array<MarketOutcome>;
  totalMarketBets: number;
}

export interface MarketOutcome {
  id: number;
  title: string;
  odds: number;
  totalBets: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin";
  balance: number;
  token: string;
}

export interface Bet {
  id: number;
  userId: number;
  marketId: number;
  outcomeId: number;
  amount: number;
  createdAt: string;
}

export interface UserProfileBet {
  id: number;
  outcomeId: number;
  amount: number;
  createdAt: string;
  market: {
    id: number;
    title: string;
    status: "active" | "resolved" | "archived";
    resolvedOutcomeId: number | null;
  };
  outcome: {
    id: number;
    title: string;
  };
}

export interface UserProfile {
  balance: number;
  apiKey: string | null;
  activeBets: Array<UserProfileBet>;
  resolvedBets: Array<UserProfileBet>;
  pagination: {
    active: {
      page: number;
      pageSize: number;
      total: number;
    };
    resolved: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
}

export interface LeaderboardEntry {
  userId: number;
  username: string;
  balance: number;
}

export interface MarketsListResponse {
  data: Array<Market>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

// API Client
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeader() {
    const token = localStorage.getItem("auth_token");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");

    const authHeader = this.getAuthHeader();
    if (authHeader.Authorization) {
      headers.set("Authorization", authHeader.Authorization);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // If there are validation errors, throw them
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessage = data.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ");
        throw new Error(errorMessage);
      }
      throw new Error(data.error || `API Error: ${response.status}`);
    }

    return data ?? {};
  }

  // Auth endpoints
  async register(username: string, email: string, password: string): Promise<User> {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(email: string, password: string): Promise<User> {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  // Markets endpoints
  async listMarkets(params?: {
    status?: "active" | "resolved" | "archived";
    page?: number;
    sortBy?: string;
  }): Promise<MarketsListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.status) {
      searchParams.set("status", params.status);
    }

    if (typeof params?.page === "number") {
      searchParams.set("page", String(params.page));
    }

    if (params?.sortBy) {
      searchParams.set("sortBy", params.sortBy);
    }

    const query = searchParams.toString();
    return this.request(`/api/markets${query ? `?${query}` : ""}`);
  }

  async getMarket(id: number): Promise<Market> {
    return this.request(`/api/markets/${id}`);
  }

  async createMarket(title: string, description: string, outcomes: Array<string>): Promise<Market> {
    return this.request("/api/markets", {
      method: "POST",
      body: JSON.stringify({ title, description, outcomes }),
    });
  }

  async resolveMarket(marketId: number, outcomeId: number): Promise<{ message: string }> {
    return this.request(`/api/markets/${marketId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ outcomeId }),
    });
  }

  async archiveMarket(marketId: number): Promise<{ message: string }> {
    return this.request(`/api/markets/${marketId}/archive`, {
      method: "POST",
    });
  }

  async getUserProfile(activePage = 1, resolvedPage = 1): Promise<UserProfile> {
    const query = new URLSearchParams({
      activePage: String(activePage),
      resolvedPage: String(resolvedPage),
    });

    return this.request(`/api/markets/profile?${query.toString()}`);
  }

  async getLeaderboard(): Promise<Array<LeaderboardEntry>> {
    return this.request("/api/leaderboard");
  }

  async generateApiKey(): Promise<{ apiKey: string }> {
    return this.request("/api/markets/generate-api-key", {
      method: "POST",
    });
  }

  // Bets endpoints
  async placeBet(marketId: number, outcomeId: number, amount: number): Promise<Bet> {
    return this.request(`/api/markets/${marketId}/bets`, {
      method: "POST",
      body: JSON.stringify({ outcomeId, amount }),
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
