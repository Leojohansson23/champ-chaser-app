import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { RequireCompletedEntry, useEntryCompletion } from "@/lib/entry-completion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarDays, ChevronRight, MessageCircle, Send, Trash2, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireCompletedEntry>
      <HomePage />
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

type LeaderboardRow = {
  user_id: string;
  username: string;
  total_points: number;
};

type CommentRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { username: string } | null;
};

function HomePage() {
  const { user, isAdmin, loading } = useAuth();
  const completion = useEntryCompletion();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const db = supabase as any;
  const displayName =
    user?.user_metadata?.username ??
    user?.user_metadata?.name ??
    (user?.email ? user.email.split("@")[0] : "");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  const loadHome = async () => {
    if (!user) return;
    const [{ data: matchRows }, { data: leaderboardRows }, { data: commentRows }] = await Promise.all([
      supabase.from("matches").select("*").order("kickoff"),
      supabase.from("leaderboard").select("*").order("total_points", { ascending: false }).limit(10),
      db
        .from("comments")
        .select("id, user_id, body, created_at, profiles(username)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setMatches((matchRows ?? []) as Match[]);
    setLeaderboard(((leaderboardRows ?? []) as LeaderboardRow[]).slice(0, 10));
    setComments((commentRows ?? []) as CommentRow[]);
  };

  useEffect(() => {
    if (!user) return;
    loadHome();
    const interval = window.setInterval(loadHome, 5000);
    window.addEventListener("focus", loadHome);
    const ch = supabase
      .channel(`home-${user.id}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, loadHome)
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, loadHome)
      .on("postgres_changes", { event: "*", schema: "public", table: "side_bet_answers" }, loadHome)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, loadHome)
      .subscribe();

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", loadHome);
      supabase.removeChannel(ch);
    };
  }, [user]);

  const todayMatches = useMemo(() => {
    const now = new Date();
    return matches.filter(match => {
      const kickoff = new Date(match.kickoff);
      return (
        kickoff.getFullYear() === now.getFullYear() &&
        kickoff.getMonth() === now.getMonth() &&
        kickoff.getDate() === now.getDate()
      );
    });
  }, [matches]);

  if (loading || !user) return null;

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = comment.trim();
    if (!body) return;
    if (body.length > 300) {
      toast.error("Kommentaren får max vara 300 tecken");
      return;
    }

    setSending(true);
    const { error } = await db.from("comments").insert({ user_id: user.id, body });
    setSending(false);

    if (error) toast.error(error.message);
    else {
      setComment("");
      loadHome();
    }
  };

  const deleteComment = async (id: string) => {
    const { error } = await db.from("comments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else loadHome();
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Hem</p>
        <h1 className="mt-1 font-display text-3xl">Hej{displayName ? `, ${displayName}` : ""}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Välkommen till VM-tipset.</p>
        {!completion.loading && !completion.isComplete && (
          <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm">
            <div className="font-semibold text-accent">Fyll i alla tips först</div>
            <p className="mt-1 text-muted-foreground">
              {completion.missingMatches > 0
                ? `${completion.missingMatches} matchtips kvar innan allt låses upp.`
                : `${completion.missingSideBets} sidospel kvar innan allt låses upp.`}
            </p>
            <Link
              to={completion.nextRequiredPath}
              className="mt-3 inline-flex rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              Fortsätt tippa
            </Link>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/45 p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Regler</p>
            <h2 className="mt-1 font-display text-xl text-accent">Kort version</h2>
          </div>
          <Link
            to="/rules"
            className="shrink-0 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            Läs alla regler
          </Link>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-foreground/90">
          <li>Exakt resultat ger 2 poäng, rätt tecken ger 1 poäng.</li>
          <li>Alla matchtips måste vara klara innan första avspark.</li>
          <li>Sidospel har egna deadlines och kan låsa separat.</li>
          <li>Topplistan visas när du fyllt i allt, eller direkt för admin.</li>
        </ul>
      </section>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.45fr)_minmax(220px,0.8fr)] md:items-start">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl text-accent">
              <CalendarDays className="size-5" /> Dagens matcher
            </h2>
            <Link to="/matches" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Alla matcher
            </Link>
          </div>
          {todayMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Inga matcher spelas idag.
            </div>
          ) : (
            <div className="space-y-2">
              {todayMatches.map(match => (
                <TodayMatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </section>

        {(completion.isComplete || isAdmin) && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg text-accent">
                <Trophy className="size-4" /> Topp 10
              </h2>
              <Link to="/leaderboard" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                Hela listan
              </Link>
            </div>
            {leaderboard.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Ingen topplista än.
              </div>
            ) : (
              <ol className="space-y-1.5">
                {leaderboard.map((row, index) => (
                  <li key={row.user_id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2.5 py-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-secondary font-display text-xs text-accent">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1 truncate text-sm font-semibold">{row.username}</div>
                    <div className="font-display text-lg leading-none text-accent">{row.total_points}</div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl text-accent">
            <MessageCircle className="size-5" /> Kommentarer
          </h2>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Senaste 20</span>
        </div>
        <form onSubmit={sendComment} className="rounded-xl border border-border/60 bg-card/60 p-2.5">
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              maxLength={300}
              placeholder="Skriv något..."
              className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              disabled={sending || !comment.trim()}
              className="flex h-10 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </div>
        </form>

        <div className="comment-scroll max-h-[360px] space-y-1.5 overflow-y-auto rounded-2xl border border-border/60 bg-card/35 p-2 pr-1.5">
          {comments.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Inga kommentarer än.
            </div>
          ) : (
            comments.map(row => (
              <article key={row.id} className="rounded-lg bg-background/45 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-semibold">{row.profiles?.username ?? "Okänd"}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">{formatTime(row.created_at)}</span>
                  </div>
                  {(row.user_id === user.id || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => deleteComment(row.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug text-foreground">{row.body}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function TodayMatchCard({ match }: { match: Match }) {
  const kickoff = new Date(match.kickoff);
  const hasResult = match.home_score !== null && match.away_score !== null;

  return (
    <Link
      to="/matches/$matchId"
      params={{ matchId: match.id }}
      className="block rounded-xl border border-border/60 bg-card/60 p-3 transition hover:border-accent/60 hover:bg-card active:scale-[0.99]"
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>Grupp {match.group_name}</span>
        <span className="flex items-center gap-1">
          {kickoff.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
          <ChevronRight className="size-3.5" />
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="truncate text-right font-semibold">{match.home_team}</div>
        <div className="font-display text-xl text-accent">
          {hasResult ? `${match.home_score}-${match.away_score}` : "vs"}
        </div>
        <div className="truncate font-semibold">{match.away_team}</div>
      </div>
    </Link>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
