import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Award,
  Copy,
  Crown,
  KeyRound,
  LogIn,
  LogOut,
  Plus,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RequireCompletedEntry } from "@/lib/entry-completion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/* eslint-disable @typescript-eslint/no-explicit-any */

const db = supabase as any;

export const Route = createFileRoute("/leagues")({
  component: () => (
    <RequireCompletedEntry>
      <LeaguesPage />
    </RequireCompletedEntry>
  ),
});

type LeagueMember = {
  user_id: string;
  profiles: { username: string } | null;
};

type League = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
  private_league_members: LeagueMember[];
};

type LeaderboardRow = {
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

function LeaguesPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [joining, setJoining] = useState(false);
  const [deletingLeagueId, setDeletingLeagueId] = useState<string | null>(null);
  const [leavingLeagueId, setLeavingLeagueId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  const load = useCallback(async () => {
    if (!user) return;
    const [
      { data: leagueRows },
      { data: leaderboard },
      { data: predictions },
      { data: sideBetAnswers },
    ] = await Promise.all([
      db
        .from("private_leagues")
        .select(
          "id, name, invite_code, owner_id, created_at, private_league_members(user_id, profiles(username))",
        )
        .order("created_at", { ascending: true }),
      supabase.from("leaderboard").select("*"),
      supabase
        .from("predictions")
        .select("user_id, predicted_home, predicted_away, matches(home_score, away_score)"),
      db.from("side_bet_answers").select("user_id, points"),
    ]);

    const nextLeagues = (leagueRows ?? []) as League[];
    const predictionStats = buildPredictionStats(
      (predictions ?? []) as unknown as PredictionWithMatch[],
    );
    const sideBetStats = buildSideBetStats((sideBetAnswers ?? []) as SideBetAnswer[]);
    const nextRows = ((leaderboard ?? []) as LeaderboardRow[])
      .map((row) => ({
        ...row,
        total_points:
          (predictionStats[row.user_id]?.points ?? 0) + (sideBetStats[row.user_id]?.points ?? 0),
        exact_count: predictionStats[row.user_id]?.exact ?? 0,
        sign_count: predictionStats[row.user_id]?.sign ?? 0,
        side_bet_count: sideBetStats[row.user_id]?.count ?? 0,
        side_bet_points: sideBetStats[row.user_id]?.points ?? 0,
      }))
      .sort((a, b) => b.total_points - a.total_points || b.exact_count - a.exact_count);

    setLeagues(nextLeagues);
    setRows(nextRows);
    setSelectedLeagueId((current) => current ?? nextLeagues[0]?.id ?? null);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
    const interval = window.setInterval(load, 5000);
    window.addEventListener("focus", load);
    const ch = supabase
      .channel(`private-leagues-${user.id}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "side_bet_answers" }, load)
      .subscribe();

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      supabase.removeChannel(ch);
    };
  }, [load, user]);

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === selectedLeagueId) ?? leagues[0] ?? null,
    [leagues, selectedLeagueId],
  );

  const leagueRows = useMemo(() => {
    if (!selectedLeague) return [];
    const members = new Map(
      selectedLeague.private_league_members.map((member) => [
        member.user_id,
        member.profiles?.username ?? "Okänd",
      ]),
    );

    return Array.from(members.entries())
      .map(([userId, username]) => {
        const row = rows.find((item) => item.user_id === userId);
        return {
          user_id: userId,
          username: row?.username ?? username,
          total_points: row?.total_points ?? 0,
          exact_count: row?.exact_count ?? 0,
          sign_count: row?.sign_count ?? 0,
          side_bet_count: row?.side_bet_count ?? 0,
          side_bet_points: row?.side_bet_points ?? 0,
        };
      })
      .sort((a, b) => b.total_points - a.total_points || b.exact_count - a.exact_count);
  }, [rows, selectedLeague]);

  const createLeague = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const name = leagueName.trim();
    if (name.length < 2) {
      toast.error("Skriv ett namn på ligan");
      return;
    }

    setSaving(true);
    const { data, error } = await db
      .from("private_leagues")
      .insert({ name, owner_id: user.id })
      .select("id")
      .single();
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setLeagueName("");
    setSelectedLeagueId(data?.id ?? null);
    toast.success("Ligan är skapad");
    load();
  };

  const joinLeague = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = inviteCode.trim();
    if (!code) {
      toast.error("Skriv in en ligakod");
      return;
    }

    setJoining(true);
    const { data, error } = await db.rpc("join_private_league", { _invite_code: code });
    setJoining(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setInviteCode("");
    setSelectedLeagueId(data ?? null);
    toast.success("Du gick med i ligan");
    load();
  };

  const copyInviteCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success("Ligakoden kopierad");
  };

  const deleteLeague = async (leagueId: string) => {
    setDeletingLeagueId(leagueId);
    const { error } = await db.from("private_leagues").delete().eq("id", leagueId);
    setDeletingLeagueId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSelectedLeagueId((current) => (current === leagueId ? null : current));
    toast.success("Ligan är borttagen");
    load();
  };

  const leaveLeague = async (leagueId: string) => {
    if (!user) return;
    setLeavingLeagueId(leagueId);
    const { error } = await db
      .from("private_league_members")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", user.id);
    setLeavingLeagueId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSelectedLeagueId((current) => (current === leagueId ? null : current));
    toast.success("Du lämnade ligan");
    load();
  };

  if (loading || !user) return null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Privat tävling</p>
        <h1 className="font-display text-3xl">Ligor</h1>
      </div>

      <section className="grid gap-3 md:grid-cols-2">
        <form
          onSubmit={createLeague}
          className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
              <Plus className="size-4" />
            </span>
            <div>
              <h2 className="font-display text-xl text-accent">Skapa liga</h2>
              <p className="text-xs text-muted-foreground">Starta en egen topplista.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={leagueName}
              onChange={(event) => setLeagueName(event.target.value)}
              maxLength={50}
              placeholder="Ex. Familjen"
              className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              disabled={saving || leagueName.trim().length < 2}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Skapa
            </button>
          </div>
        </form>

        <form
          onSubmit={joinLeague}
          className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
              <KeyRound className="size-4" />
            </span>
            <div>
              <h2 className="font-display text-xl text-accent">Gå med</h2>
              <p className="text-xs text-muted-foreground">Använd koden du fått.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              maxLength={16}
              placeholder="LIGAKOD"
              className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm font-semibold uppercase tracking-wider outline-none focus:border-accent"
            />
            <button
              disabled={joining || !inviteCode.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <LogIn className="size-4" /> Gå med
            </button>
          </div>
        </form>
      </section>

      {leagues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Du är inte med i någon privat liga än.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
          <aside className="space-y-2">
            {leagues.map((league) => (
              <button
                key={league.id}
                type="button"
                onClick={() => setSelectedLeagueId(league.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedLeague?.id === league.id
                    ? "border-accent/70 bg-accent/10"
                    : "border-border/60 bg-card/45 hover:bg-card"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {league.name}
                  </span>
                  {league.owner_id === user.id && <Crown className="size-3.5 text-accent" />}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {league.private_league_members.length} medlemmar
                </div>
              </button>
            ))}
          </aside>

          {selectedLeague && (
            <section className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Intern topplista
                  </p>
                  <h2 className="font-display text-2xl text-accent">{selectedLeague.name}</h2>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => copyInviteCode(selectedLeague.invite_code)}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-left hover:bg-secondary"
                  >
                    <Copy className="size-4 text-accent" />
                    <span>
                      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                        Kod
                      </span>
                      <span className="block font-mono text-sm font-semibold">
                        {selectedLeague.invite_code}
                      </span>
                    </span>
                  </button>

                  {selectedLeague.owner_id === user.id || isAdmin ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          title="Ta bort liga"
                          className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-background/35 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Ta bort ligan?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Ligan och medlemslistan tas bort. Medlemmarnas tips och poäng finns kvar
                            i huvudtävlingen.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Avbryt</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={deletingLeagueId === selectedLeague.id}
                            onClick={() => deleteLeague(selectedLeague.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Ta bort liga
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          title="Lämna liga"
                          className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-background/35 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <LogOut className="size-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Lämna ligan?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Du försvinner från den här privata topplistan, men dina tips och poäng
                            finns kvar i huvudtävlingen.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Avbryt</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={leavingLeagueId === selectedLeague.id}
                            onClick={() => leaveLeague(selectedLeague.id)}
                          >
                            Lämna liga
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>

              {leagueRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Inga medlemmar i ligan än.
                </div>
              ) : (
                <ol className="space-y-2">
                  {leagueRows.map((row, index) => (
                    <li
                      key={row.user_id}
                      className={`flex items-center gap-3 rounded-xl border border-border/60 bg-background/35 p-3 ${
                        row.user_id === user.id ? "ring-1 ring-accent" : ""
                      }`}
                    >
                      <div className="flex size-10 items-center justify-center rounded-full bg-secondary font-display text-lg">
                        {index === 0 ? (
                          <Trophy className="size-5 text-accent" />
                        ) : index === 1 ? (
                          <Award className="size-5 text-muted-foreground" />
                        ) : (
                          <span className="text-muted-foreground">{index + 1}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{row.username}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.sign_count} Rätt 1X2 · {row.exact_count} Rätt resultat ·{" "}
                          {row.side_bet_count ?? 0} Rätt sidospel
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-2xl leading-none text-accent">
                          {row.total_points}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          poäng
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
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
