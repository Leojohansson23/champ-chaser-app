import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Trophy, UserRound, Users } from "lucide-react";
import { RequireCompletedEntry } from "@/lib/entry-completion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/matches_/$matchId")({
  component: () => (
    <RequireCompletedEntry>
      <MatchDetailPage />
    </RequireCompletedEntry>
  ),
});

type Match = {
  id: string;
  group_name: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  home_score: number | null;
  away_score: number | null;
};

type PredictionRow = {
  id: string;
  user_id: string;
  predicted_home: number;
  predicted_away: number;
  points: number;
};

type ProfileRow = {
  id: string;
  username: string;
};

type DisplayPrediction = PredictionRow & {
  username: string;
};

function MatchDetailPage() {
  const { matchId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [predictions, setPredictions] = useState<DisplayPrediction[]>([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  const load = useCallback(async () => {
    if (!user) return;

    const { data: matchRow } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    const currentMatch = (matchRow ?? null) as Match | null;
    setMatch(currentMatch);

    if (!currentMatch || !isToday(currentMatch.kickoff)) {
      setPredictions([]);
      setFetched(true);
      return;
    }

    const { data: predictionRows } = await supabase
      .from("predictions")
      .select("id, user_id, predicted_home, predicted_away, points")
      .eq("match_id", matchId);

    const rows = (predictionRows ?? []) as PredictionRow[];
    const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
    const { data: profileRows } = userIds.length
      ? await supabase.from("profiles").select("id, username").in("id", userIds)
      : { data: [] };

    const names = new Map(
      (profileRows ?? ([] as ProfileRow[])).map((profile) => [profile.id, profile.username]),
    );
    setPredictions(
      rows
        .map((row) => ({ ...row, username: names.get(row.user_id) ?? "Okänd" }))
        .sort(
          (a, b) =>
            Number(b.user_id === user.id) - Number(a.user_id === user.id) ||
            a.username.localeCompare(b.username, "sv"),
        ),
    );
    setFetched(true);
  }, [matchId, user]);

  useEffect(() => {
    if (!user) return;
    load();
    const interval = window.setInterval(load, 5000);
    window.addEventListener("focus", load);
    const ch = supabase
      .channel(`match-detail-${matchId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "predictions", filter: `match_id=eq.${matchId}` },
        load,
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      supabase.removeChannel(ch);
    };
  }, [load, matchId, user]);

  const hasResult = match?.home_score !== null && match?.away_score !== null;
  const canView = !!match && isToday(match.kickoff);
  const kickoff = useMemo(() => (match ? new Date(match.kickoff) : null), [match]);
  const currentUserId = user?.id ?? "";
  const ownPrediction = predictions.find((prediction) => prediction.user_id === currentUserId);
  const otherPredictions = predictions.filter((prediction) => prediction.user_id !== currentUserId);

  if (loading || !user || !fetched) return null;

  if (!match) {
    return (
      <UnavailableMatch
        title="Matchen finns inte"
        body="Den har tagits bort eller kunde inte hittas."
      />
    );
  }

  if (!canView) {
    return (
      <UnavailableMatch
        title="Bara dagens matcher"
        body="Du kan bara klicka dig in och se andras tips för matcher som spelas idag."
      />
    );
  }

  return (
    <div className="space-y-5">
      <Link
        to="/matches"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Matcher
      </Link>

      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Dagens match · Grupp {match.group_name}</span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {kickoff?.toLocaleString("sv-SE", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <div className="min-w-0 text-right font-display text-4xl leading-none">
            {match.home_team}
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-2 font-display text-4xl leading-none text-accent">
            {hasResult ? `${match.home_score}-${match.away_score}` : "vs"}
          </div>
          <div className="min-w-0 font-display text-4xl leading-none">{match.away_team}</div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <UserRound className="size-4 text-accent" />
          <h1 className="font-display text-2xl text-accent">Ditt tips</h1>
        </div>

        {ownPrediction ? (
          <PredictionCard prediction={ownPrediction} hasResult={hasResult} highlighted />
        ) : (
          <div className="rounded-2xl border border-dashed border-accent/30 bg-accent/5 p-5 text-center text-sm text-muted-foreground">
            Du har inte tippat på den här matchen än.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-2xl text-accent">
            <Users className="size-4" /> Deltagare
          </h2>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {otherPredictions.length} tips
          </span>
        </div>

        {otherPredictions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Inga andra deltagare har tippat på den här matchen än.
          </div>
        ) : (
          <div className="space-y-2">
            {otherPredictions.map((prediction) => (
              <PredictionCard key={prediction.id} prediction={prediction} hasResult={hasResult} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PredictionCard({
  prediction,
  hasResult,
  highlighted = false,
}: {
  prediction: DisplayPrediction;
  hasResult: boolean;
  highlighted?: boolean;
}) {
  return (
    <article
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        highlighted ? "border-accent/50 bg-accent/10" : "border-border/60 bg-card/60"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold">{prediction.username}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Tippat resultat
        </div>
      </div>
      <div className="rounded-lg bg-background/70 px-3 py-1 font-display text-3xl leading-none text-foreground">
        {prediction.predicted_home}-{prediction.predicted_away}
      </div>
      {hasResult && (
        <div className="flex min-w-12 items-center justify-end gap-1 text-right font-display text-xl text-accent">
          <Trophy className="size-4" />
          {prediction.points}
        </div>
      )}
    </article>
  );
}

function UnavailableMatch({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-4">
      <Link
        to="/matches"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Matcher
      </Link>
      <section className="rounded-2xl border border-border/60 bg-card/60 p-8 text-center">
        <h1 className="font-display text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </section>
    </div>
  );
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
