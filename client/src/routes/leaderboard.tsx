import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type LeaderboardWithOptionalProfit = {
  userId: number;
  username: string;
  balance: number;
  profit?: number;
};

const STARTING_BALANCE = 1000;

function getProfit(entry: LeaderboardWithOptionalProfit): number {
  if (typeof entry.profit === "number") {
    return entry.profit;
  }

  return entry.balance - STARTING_BALANCE;
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function LeaderboardPage() {
  const { data, isPending, error } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.getLeaderboard(),
  });

  const ranked = (data ?? [])
    .map((entry) => ({
      ...entry,
      computedProfit: getProfit(entry as LeaderboardWithOptionalProfit),
    }))
    .sort((a, b) => b.computedProfit - a.computedProfit)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Leaderboard</CardTitle>
            <CardDescription>Top 10 users by total winnings (profit)</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load leaderboard"}
              </div>
            )}

            {isPending ? (
              <p className="text-muted-foreground">Loading leaderboard...</p>
            ) : ranked.length === 0 ? (
              <p className="text-muted-foreground">No leaderboard data available yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="py-2 pr-4">Rank</th>
                      <th className="py-2 pr-4">Username</th>
                      <th className="py-2 text-right">Total Winnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((entry, index) => (
                      <tr key={entry.userId} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-semibold">#{index + 1}</td>
                        <td className="py-3 pr-4">{entry.username}</td>
                        <td
                          className={`py-3 text-right font-medium ${
                            entry.computedProfit >= 0 ? "text-emerald-600" : "text-destructive"
                          }`}
                        >
                          {entry.computedProfit >= 0 ? "+" : ""}
                          {formatMoney(entry.computedProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
});
