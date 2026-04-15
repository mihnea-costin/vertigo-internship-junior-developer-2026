import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

function ProfilePage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [activePage, setActivePage] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(1);
  const [isGeneratingApiKey, setIsGeneratingApiKey] = useState(false);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["profile", activePage, resolvedPage],
    queryFn: () => api.getUserProfile(activePage, resolvedPage),
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  const handleGenerateApiKey = async () => {
    try {
      setIsGeneratingApiKey(true);
      await api.generateApiKey();
      await refetch();
    } finally {
      setIsGeneratingApiKey(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
            <p className="text-muted-foreground">Please log in to view your profile.</p>
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeTotal = data?.pagination.active.total ?? 0;
  const activePageSize = data?.pagination.active.pageSize ?? 20;
  const resolvedTotal = data?.pagination.resolved.total ?? 0;
  const resolvedPageSize = data?.pagination.resolved.pageSize ?? 20;

  const canGoNextActive = activePage * activePageSize < activeTotal;
  const canGoNextResolved = resolvedPage * resolvedPageSize < resolvedTotal;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <Card>
          <CardHeader>
            <CardDescription>Available Balance</CardDescription>
            <CardTitle className="text-4xl font-bold text-primary">
              ${data?.balance.toFixed(2) ?? "0.00"}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Key</CardTitle>
            <CardDescription>Generate an API key to enable bot access.</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.apiKey ? (
              <div className="rounded-md border bg-muted px-4 py-3 break-all font-mono text-sm">
                {data.apiKey}
              </div>
            ) : (
              <Button onClick={handleGenerateApiKey} disabled={isGeneratingApiKey}>
                {isGeneratingApiKey ? "Generating..." : "Generate API Key"}
              </Button>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load profile"}
          </div>
        )}

        {isPending ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">Loading bets...</CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Active Bets</CardTitle>
                <CardDescription>{activeTotal} total active bets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(data?.activeBets ?? []).length === 0 ? (
                  <p className="text-muted-foreground">No active bets yet.</p>
                ) : (
                  <div className="space-y-3">
                    {(data?.activeBets ?? []).map((bet) => (
                      <div key={bet.id} className="rounded-md border p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Market</p>
                            <p className="font-medium">{bet.market.title}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Outcome</p>
                            <p className="font-medium">{bet.outcome.title}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Amount</p>
                            <p className="font-medium">${bet.amount.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <Badge variant="outline">Active</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setActivePage((prev) => prev - 1)}
                    disabled={activePage === 1}
                  >
                    Prev
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {activePage}</span>
                  <Button
                    variant="outline"
                    onClick={() => setActivePage((prev) => prev + 1)}
                    disabled={!canGoNextActive}
                  >
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resolved Bets</CardTitle>
                <CardDescription>{resolvedTotal} total resolved bets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(data?.resolvedBets ?? []).length === 0 ? (
                  <p className="text-muted-foreground">No resolved bets yet.</p>
                ) : (
                  <div className="space-y-3">
                    {(data?.resolvedBets ?? []).map((bet) => {
                      const isWinning = bet.outcomeId === bet.market.resolvedOutcomeId;

                      return (
                        <div key={bet.id} className="rounded-md border p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Market</p>
                              <p className="font-medium">{bet.market.title}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Outcome</p>
                              <p className="font-medium">{bet.outcome.title}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Amount</p>
                              <p className="font-medium">${bet.amount.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Result</p>
                              <Badge variant={isWinning ? "default" : "destructive"}>
                                {isWinning ? "WIN" : "LOSS"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setResolvedPage((prev) => prev - 1)}
                    disabled={resolvedPage === 1}
                  >
                    Prev
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {resolvedPage}</span>
                  <Button
                    variant="outline"
                    onClick={() => setResolvedPage((prev) => prev + 1)}
                    disabled={!canGoNextResolved}
                  >
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});
