import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RequireCompletedEntry } from "@/lib/entry-completion";
import { Trophy, Medal, Award, Coins } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/leaderboard")({
  component: () => (
    <RequireCompletedEntry>
      <LeaderboardPage />
    </RequireCompletedEntry>
  ),
});

type Row = {
  user_id: string;
  username: string;
  total_points: number;
  exact_count: number;
  sign_count: number;
  side_bet_count?: number;
  side_bet_points?: number;
};
type PredictionWithMatch = {
  user_id: string;
  predicted_home: number;
  predicted_away: number;
  matches: {
    home_score: number | null;
    away_score: number | null;
  } | null;
};
type SideBetAnswer = {
  user_id: string;
  points: number;
};

function LeaderboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [prizePot, setPrizePot] = useState(0);
  const [entryFee, setEntryFee] = useState(0);
  const [paidCount, setPaidCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const load = async () => {
    const [
      { data: leaderboard },
      { data: predictions },
      { data: sideBetAnswers },
      { data: entryFeeSetting },
      { data: profiles },
    ] = await Promise.all([
      supabase.from("leaderboard").select("*"),
      supabase
        .from("predictions")
        .select("user_id, predicted_home, predicted_away, matches(home_score, away_score)"),
      (supabase as any).from("side_bet_answers").select("user_id, points"),
      (supabase as any).from("app_settings").select("value").eq("key", "entry_fee").maybeSingle(),
      (supabase as any).from("profiles").select("id, is_paid"),
    ]);
    const fee = Number(entryFeeSetting?.value?.amount ?? 100);
    const paid = ((profiles ?? []) as Array<{ id: string; is_paid: boolean }>).filter(
      (profile) => profile.is_paid,
    ).length;
    setEntryFee(fee);
    setPaidCount(paid);
    setPrizePot(fee * paid);
    const stats = buildPredictionStats((predictions ?? []) as unknown as PredictionWithMatch[]);
    const sideBetStats = buildSideBetStats((sideBetAnswers ?? []) as SideBetAnswer[]);
    const sorted = ((leaderboard ?? []) as Row[])
      .map((row) => ({
        ...row,
        total_points: (stats[row.user_id]?.points ?? 0) + (sideBetStats[row.user_id]?.points ?? 0),
        exact_count: stats[row.user_id]?.exact ?? 0,
        sign_count: stats[row.user_id]?.sign ?? 0,
        side_bet_count: sideBetStats[row.user_id]?.count ?? 0,
        side_bet_points: sideBetStats[row.user_id]?.points ?? 0,
      }))
      .sort((a, b) => b.total_points - a.total_points || b.exact_count - a.exact_count);
    setRows(sorted);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const interval = window.setInterval(load, 5000);
    window.addEventListener("focus", load);
    const ch = supabase
      .channel("lb")
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "side_bet_answers" }, load)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.entry_fee" },
        load,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      supabase.removeChannel(ch);
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Live</p>
          <h1 className="font-display text-3xl">Topplista</h1>
        </div>
        <div className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Coins className="size-3.5 text-accent" /> Prispott
          </div>
          <div className="font-display text-2xl leading-none text-accent">
            {formatPrizePot(prizePot)}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {paidCount} betalda x {formatPrizePot(entryFee)}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Inga tippare än.
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.user_id}
              className={`flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3 backdrop-blur ${
                r.user_id === user.id ? "ring-1 ring-accent" : ""
              }`}
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-secondary font-display text-lg">
                {i === 0 ? (
                  <Trophy className="size-5 text-accent" />
                ) : i === 1 ? (
                  <Medal className="size-5 text-muted-foreground" />
                ) : i === 2 ? (
                  <Award className="size-5 text-accent/70" />
                ) : (
                  <span className="text-muted-foreground">{i + 1}</span>
                )}
              </div>
              <div className="flex-1">
                <Link
                  to="/users/$userId"
                  params={{ userId: r.user_id }}
                  className="font-semibold hover:text-accent"
                >
                  {r.username}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {r.sign_count} Rätt 1X2 (1p) · {r.exact_count} Rätt resultat (2p) ·{" "}
                  {r.side_bet_count ?? 0} Rätt sidospel ({r.side_bet_points ?? 0}p)
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl text-accent">{r.total_points}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  poäng
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function formatPrizePot(amount: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildPredictionStats(predictions: PredictionWithMatch[]) {
  const stats: Record<string, { exact: number; sign: number; points: number }> = {};

  for (const prediction of predictions) {
    const match = prediction.matches;
    if (!match || match.home_score === null || match.away_score === null) continue;

    const userStats = stats[prediction.user_id] ?? { exact: 0, sign: 0, points: 0 };
    const exact =
      prediction.predicted_home === match.home_score &&
      prediction.predicted_away === match.away_score;
    const predictedSign = getSign(prediction.predicted_home, prediction.predicted_away);
    const actualSign = getSign(match.home_score, match.away_score);

    if (exact) {
      userStats.exact += 1;
      userStats.points += 3;
    } else if (predictedSign === actualSign) {
      userStats.points += 1;
    }
    if (predictedSign === actualSign) userStats.sign += 1;

    stats[prediction.user_id] = userStats;
  }

  return stats;
}

function getSign(home: number, away: number) {
  if (home > away) return "1";
  if (home < away) return "2";
  return "X";
}

function buildSideBetStats(answers: SideBetAnswer[]) {
  const stats: Record<string, { count: number; points: number }> = {};

  for (const answer of answers) {
    if (answer.points <= 0) continue;
    const userStats = stats[answer.user_id] ?? { count: 0, points: 0 };
    userStats.count += 1;
    userStats.points += answer.points;
    stats[answer.user_id] = userStats;
  }

  return stats;
}
