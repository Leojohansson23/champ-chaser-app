import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { RequireCompletedEntry, useEntryCompletion } from "@/lib/entry-completion";
import { supabase } from "@/integrations/supabase/client";
import { TeamWithFlag } from "../lib/flags";
import { toast } from "sonner";
import {
  CalendarDays,
  Award,
  ChevronDown,
  ChevronRight,
  Clock3,
  Coins,
  Medal,
  Megaphone,
  MessageCircle,
  Pin,
  Send,
  ShieldCheck,
  SmilePlus,
  Target,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const db = supabase as any;

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
  city: string | null;
  stadium: string | null;
};

type LeaderboardRow = {
  user_id: string;
  username: string;
  total_points: number;
  exact_count?: number;
};

type CommentRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { username: string } | null;
};

type AdminAnnouncement = {
  id: string;
  title: string;
  body: string;
  tone: "info" | "fun" | "urgent";
  created_at: string;
};

type AnnouncementReaction = {
  id: string;
  announcement_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
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

function HomePage() {
  const { user, isAdmin, loading } = useAuth();
  const completion = useEntryCompletion();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [announcementReactions, setAnnouncementReactions] = useState<AnnouncementReaction[]>([]);
  const [prizePot, setPrizePot] = useState(0);
  const [entryFee, setEntryFee] = useState(0);
  const [paidCount, setPaidCount] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [previousOpen, setPreviousOpen] = useState(false);
  const [previousDayIndex, setPreviousDayIndex] = useState(0);
  const displayName =
    user?.user_metadata?.username ??
    user?.user_metadata?.name ??
    (user?.email ? user.email.split("@")[0] : "");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  const loadHome = useCallback(async () => {
    if (!user) return;
    const [
      { data: matchRows },
      { data: leaderboardRows },
      { data: predictionRows },
      { data: sideBetAnswerRows },
      { data: commentRows },
      { data: announcementRows },
      { data: announcementReactionRows },
      { data: entryFeeSetting },
      { data: profiles },
    ] = await Promise.all([
      supabase.from("matches").select("*").order("kickoff"),
      supabase.from("leaderboard").select("*"),
      supabase
        .from("predictions")
        .select("user_id, predicted_home, predicted_away, matches(home_score, away_score)"),
      db.from("side_bet_answers").select("user_id, points"),
      db
        .from("comments")
        .select("id, user_id, body, created_at, profiles(username)")
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("admin_announcements")
        .select("id, title, body, tone, created_at")
        .eq("is_active", true)
        .gte("created_at", getAnnouncementCutoff())
        .order("created_at", { ascending: false }),
      db
        .from("admin_announcement_reactions")
        .select("id, announcement_id, user_id, emoji, created_at")
        .order("created_at", { ascending: true }),
      db.from("app_settings").select("value").eq("key", "entry_fee").maybeSingle(),
      db.from("profiles").select("id, is_paid"),
    ]);

    setMatches((matchRows ?? []) as Match[]);
    const predictionStats = buildPredictionStats(
      (predictionRows ?? []) as unknown as PredictionWithMatch[],
    );
    const sideBetStats = buildSideBetStats((sideBetAnswerRows ?? []) as SideBetAnswer[]);
    setLeaderboard(
      ((leaderboardRows ?? []) as LeaderboardRow[])
        .map((row) => ({
          ...row,
          total_points:
            (predictionStats[row.user_id]?.points ?? 0) +
            (sideBetStats[row.user_id]?.points ?? 0),
          exact_count: predictionStats[row.user_id]?.exact ?? 0,
        }))
        .sort((a, b) => b.total_points - a.total_points || (b.exact_count ?? 0) - (a.exact_count ?? 0))
        .slice(0, 10),
    );
    setComments((commentRows ?? []) as CommentRow[]);
    setAnnouncements((announcementRows ?? []) as AdminAnnouncement[]);
    setAnnouncementReactions((announcementReactionRows ?? []) as AnnouncementReaction[]);
    const fee = Number(entryFeeSetting?.value?.amount ?? 100);
    const paid = ((profiles ?? []) as Array<{ id: string; is_paid: boolean }>).filter(
      (profile) => profile.is_paid,
    ).length;
    setEntryFee(fee);
    setPaidCount(paid);
    setPrizePot(fee * paid);
  }, [user]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_announcements" }, loadHome)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_announcement_reactions" },
        loadHome,
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", loadHome);
      supabase.removeChannel(ch);
    };
  }, [loadHome, user]);

  const todayMatches = useMemo(() => {
    const now = new Date();
    return matches.filter((match) => {
      const kickoff = new Date(match.kickoff);
      return (
        kickoff.getFullYear() === now.getFullYear() &&
        kickoff.getMonth() === now.getMonth() &&
        kickoff.getDate() === now.getDate()
      );
    });
  }, [matches]);

  const previousMatches = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return matches
      .filter((match) => new Date(match.kickoff) < startOfToday)
      .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
  }, [matches]);

  const previousMatchDays = useMemo(() => {
    const days = new Map<string, Match[]>();
    previousMatches.forEach((match) => {
      const key = formatDateKey(match.kickoff);
      days.set(key, [...(days.get(key) ?? []), match]);
    });
    return Array.from(days.entries()).map(([dateKey, dayMatches]) => ({
      dateKey,
      matches: dayMatches,
    }));
  }, [previousMatches]);

  useEffect(() => {
    setPreviousDayIndex((index) => Math.min(index, Math.max(0, previousMatchDays.length - 1)));
  }, [previousMatchDays.length]);

  const selectedPreviousDay = previousMatchDays[previousDayIndex] ?? null;

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

  const toggleAnnouncementReaction = async (announcementId: string, emoji: string) => {
    const normalizedEmoji = emoji.trim();
    if (!normalizedEmoji) return;

    const existing = announcementReactions.find(
      (reaction) =>
        reaction.announcement_id === announcementId && reaction.user_id === user.id,
    );

    const { error } = existing
      ? existing.emoji === normalizedEmoji
        ? await db.from("admin_announcement_reactions").delete().eq("id", existing.id)
        : await db
            .from("admin_announcement_reactions")
            .update({ emoji: normalizedEmoji })
            .eq("id", existing.id)
      : await db
          .from("admin_announcement_reactions")
          .insert({ announcement_id: announcementId, user_id: user.id, emoji: normalizedEmoji });

    if (error) toast.error(error.message);
    else loadHome();
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Hem</p>
            <h1 className="mt-1 truncate font-display text-3xl">
              Hej{displayName ? `, ${displayName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Välkommen till VM-tipset.</p>
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

      {announcements.length > 0 && (
        <AdminAnnouncementsPanel
          announcements={announcements}
          reactions={announcementReactions}
          currentUserId={user.id}
          onReactionToggle={toggleAnnouncementReaction}
        />
      )}

      <section className="rounded-2xl border border-border/60 bg-card/45 p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Kom ihåg</p>
            <h2 className="mt-1 font-display text-xl text-accent">Det viktigaste</h2>
          </div>
          <Link
            to="/rules"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            Alla regler
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <HomeRuleItem
            icon={<Medal className="size-4" />}
            title="Poäng"
            text="3p för rätt resultat, 1p för Rätt 1X2."
          />
          <HomeRuleItem
            icon={<Clock3 className="size-4" />}
            title="Deadline"
            text="Matchtips låses 10 juni 2026 kl. 23:59."
          />
          <HomeRuleItem
            icon={<Target className="size-4" />}
            title="Sidospel"
            text="Bonusfrågor som stänger samtidigt som matchtipset."
          />
          <HomeRuleItem
            icon={<ShieldCheck className="size-4" />}
            title="Lås upp"
            text="Topplistor och ligor visas när alla tips är ifyllda."
          />
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.45fr)_minmax(220px,0.8fr)] md:items-start">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl text-accent">
              <CalendarDays className="size-5" /> Dagens matcher
            </h2>
            <Link
              to="/tips"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Alla matcher
            </Link>
          </div>
          {todayMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Inga matcher spelas idag.
            </div>
          ) : (
            <div className="space-y-2">
              {todayMatches.map((match) => (
                <TodayMatchCard key={match.id} match={match} />
              ))}
            </div>
          )}

          <section className="pt-3">
            <button
              type="button"
              onClick={() => setPreviousOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/45 px-3 py-2.5 text-left transition hover:bg-card"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Clock3 className="size-5 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block font-display text-xl leading-none text-accent">
                    Föregående matcher
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {previousMatches.length} matcher
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {previousOpen ? "Stäng" : "Öppna"}
                <ChevronDown
                  className={`size-4 transition-transform ${previousOpen ? "rotate-180" : ""}`}
                />
              </span>
            </button>

            {previousOpen && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviousDayIndex((index) =>
                        Math.min(index + 1, previousMatchDays.length - 1),
                      )
                    }
                    disabled={previousDayIndex >= previousMatchDays.length - 1}
                    className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary disabled:opacity-40"
                  >
                    Föregående dag
                  </button>
                  <div className="min-w-0 text-center">
                    <div className="font-display text-lg leading-none text-accent">
                      {selectedPreviousDay
                        ? formatPreviousDayLabel(selectedPreviousDay.dateKey)
                        : "Inga matcher"}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {selectedPreviousDay?.matches.length ?? 0} matcher
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviousDayIndex((index) => Math.max(index - 1, 0))}
                    disabled={previousDayIndex <= 0}
                    className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary disabled:opacity-40"
                  >
                    Nästa dag
                  </button>
                </div>
                <div className="flex justify-end">
                  <Link
                    to="/tips"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Alla matcher
                  </Link>
                </div>
                {previousMatches.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Inga föregående matcher än.
                  </div>
                ) : (
                  selectedPreviousDay?.matches.map((match) => (
                    <TodayMatchCard key={match.id} match={match} variant="previous" />
                  ))
                )}
              </div>
            )}
          </section>
        </section>

        {(completion.isComplete || isAdmin) && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg text-accent">
                <Trophy className="size-4" /> Topp 10
              </h2>
              <Link
                to="/leaderboard"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
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
                  <li
                    key={row.user_id}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2.5 py-2"
                  >
                    <div className="flex size-7 items-center justify-center rounded-full bg-secondary font-display text-xs text-accent">
                      {index === 0 ? (
                        <Trophy className="size-4 text-accent" />
                      ) : index === 1 ? (
                        <Medal className="size-4 text-muted-foreground" />
                      ) : index === 2 ? (
                        <Award className="size-4 text-accent/70" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <Link
                      to="/users/$userId"
                      params={{ userId: row.user_id }}
                      className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-accent"
                    >
                      {row.username}
                    </Link>
                    <div className="font-display text-lg leading-none text-accent">
                      {row.total_points}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>

      <section className="rounded-2xl border border-border/60 bg-card/45 backdrop-blur">
        <button
          type="button"
          onClick={() => setChatOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
              <MessageCircle className="size-4" />
            </span>
            <span>
              <span className="block font-display text-xl text-accent">Kommentarer</span>
              <span className="block text-xs text-muted-foreground">
                {comments.length === 0 ? "Inga kommentarer än" : `${comments.length} senaste`}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {chatOpen ? "Stäng" : "Öppna"}
            <ChevronDown
              className={`size-4 transition-transform ${chatOpen ? "rotate-180" : ""}`}
            />
          </span>
        </button>

        {chatOpen && (
          <div className="space-y-3 border-t border-border/60 p-3">
            <form
              onSubmit={sendComment}
              className="rounded-xl border border-border/60 bg-card/60 p-2.5"
            >
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
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

            <div className="comment-scroll max-h-[360px] space-y-1.5 overflow-y-auto rounded-xl border border-border/60 bg-background/25 p-2 pr-1.5">
              {comments.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Inga kommentarer än.
                </div>
              ) : (
                comments.map((row) => (
                  <article key={row.id} className="rounded-lg bg-background/45 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate text-sm">
                        <span className="font-semibold">{row.profiles?.username ?? "Okänd"}</span>
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {formatTime(row.created_at)}
                        </span>
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
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug text-foreground">
                      {row.body}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function TodayMatchCard({
  match,
  variant = "today",
}: {
  match: Match;
  variant?: "today" | "previous";
}) {
  const kickoff = new Date(match.kickoff);
  const hasResult = match.home_score !== null && match.away_score !== null;
  const hasVenue = !!(match.city || match.stadium);
  const showStartTime = variant === "today";

  return (
    <Link
      to="/matches/$matchId"
      params={{ matchId: match.id }}
      className="group block rounded-xl border border-border/60 bg-card/60 p-3.5 transition hover:border-accent/70 hover:bg-card active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Grupp {match.group_name}</span>
        {showStartTime && (
          <span className="justify-self-end rounded-full border border-border/60 bg-background/45 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
            Matchstart {kickoff.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
      {hasVenue && (
        <div className="mx-auto mt-1 max-w-[78%] text-center leading-tight">
          {match.city && (
            <div className="truncate text-[11px] font-semibold text-foreground/90">
              {match.city}
            </div>
          )}
          {match.stadium && (
            <div className="truncate text-[10px] font-medium text-muted-foreground">
              {match.stadium}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5">
        <div className="min-w-0 text-right text-base font-bold leading-tight">
          <TeamWithFlag
            team={match.home_team}
            align="right"
            flagClassName="h-4 w-6"
            textClassName="min-w-0 whitespace-normal break-words"
          />
        </div>
        <div className="rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 font-display text-2xl leading-none text-accent">
          {hasResult ? `${match.home_score}-${match.away_score}` : "vs"}
        </div>
        <div className="min-w-0 text-base font-bold leading-tight">
          <TeamWithFlag
            team={match.away_team}
            flagClassName="h-4 w-6"
            textClassName="min-w-0 whitespace-normal break-words"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent transition group-hover:border-accent/45 group-hover:bg-accent/15">
          <Users className="size-3" />
          Visa tips
          <ChevronRight className="size-3" />
        </span>
      </div>
    </Link>
  );
}

function HomeRuleItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function AdminAnnouncementsPanel({
  announcements,
  reactions,
  currentUserId,
  onReactionToggle,
}: {
  announcements: AdminAnnouncement[];
  reactions: AnnouncementReaction[];
  currentUserId: string;
  onReactionToggle: (announcementId: string, emoji: string) => void;
}) {
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState(announcements[0]?.id ?? "");
  const [previousOpen, setPreviousOpen] = useState(false);
  const featured =
    announcements.find((announcement) => announcement.id === selectedAnnouncementId) ??
    announcements[0];
  const visibleMiniAnnouncements = announcements
    .filter((announcement) => announcement.id !== featured.id)
    .slice(0, 3);

  return (
    <section className="overflow-hidden rounded-xl border border-[oklch(0.72_0.13_235_/_0.48)] bg-card/60 shadow-md shadow-black/10 backdrop-blur">
      <article className="relative p-3 sm:p-4">
        <div className="absolute inset-x-0 top-0 h-px bg-[oklch(0.72_0.13_235_/_0.58)]" />
        <div className="absolute right-3 top-3 rounded-full border border-border/50 bg-background/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {formatAnnouncementExpiry(featured.created_at)}
        </div>
        <div className="flex items-start gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
            <Megaphone className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
                Aktuellt
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {formatTime(featured.created_at)}
              </span>
            </div>
            <h2 className="mt-1.5 font-sans text-xl font-extrabold leading-tight text-foreground">
              {featured.title}
            </h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-snug text-foreground/90">
              {featured.body}
            </p>
            <AnnouncementReactions
              announcementId={featured.id}
              reactions={reactions.filter((reaction) => reaction.announcement_id === featured.id)}
              currentUserId={currentUserId}
              onReactionToggle={onReactionToggle}
            />
          </div>
        </div>
      </article>

      {visibleMiniAnnouncements.length > 0 && (
        <div className="border-t border-[oklch(0.68_0.12_235_/_0.18)] bg-background/20">
          <button
            type="button"
            onClick={() => setPreviousOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-[oklch(0.68_0.12_235_/_0.08)]"
          >
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
              Mer från admins
            </span>
            <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {visibleMiniAnnouncements.length} till
              <ChevronDown
                className={`size-3.5 text-[oklch(0.76_0.12_235)] transition-transform ${
                  previousOpen ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>

          {previousOpen && (
            <div className="grid gap-1.5 px-2.5 pb-2 sm:grid-cols-3">
              {visibleMiniAnnouncements.map((announcement) => (
                <AdminAnnouncementMini
                  key={announcement.id}
                  announcement={announcement}
                  onSelect={() => {
                    setSelectedAnnouncementId(announcement.id);
                    setPreviousOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const QUICK_REACTION_EMOJIS = [
  "❤️",
  "🔥",
  "😂",
  "👏",
  "😍",
  "😮",
  "😢",
  "😡",
  "🏆",
  "⚽",
  "🍻",
  "🎯",
];

function AnnouncementReactions({
  announcementId,
  reactions,
  currentUserId,
  onReactionToggle,
}: {
  announcementId: string;
  reactions: AnnouncementReaction[];
  currentUserId: string;
  onReactionToggle: (announcementId: string, emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customEmoji, setCustomEmoji] = useState("");
  const groupedReactions = useMemo(() => {
    const groups = new Map<string, { count: number; reactedByMe: boolean }>();

    for (const reaction of reactions) {
      const group = groups.get(reaction.emoji) ?? { count: 0, reactedByMe: false };
      group.count += 1;
      group.reactedByMe ||= reaction.user_id === currentUserId;
      groups.set(reaction.emoji, group);
    }

    return Array.from(groups.entries()).sort(
      ([emojiA, groupA], [emojiB, groupB]) =>
        groupB.count - groupA.count || emojiA.localeCompare(emojiB),
    );
  }, [currentUserId, reactions]);

  const addReaction = (emoji: string) => {
    const normalizedEmoji = emoji.trim();
    if (!normalizedEmoji) return;
    if (!isEmojiReaction(normalizedEmoji)) {
      toast.error("Använd bara emojis som reaktion");
      return;
    }
    onReactionToggle(announcementId, normalizedEmoji);
    setCustomEmoji("");
    setPickerOpen(false);
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {groupedReactions.map(([emoji, group]) => (
          <button
            key={emoji}
            type="button"
            onClick={() => addReaction(emoji)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-sm font-semibold transition active:scale-[0.98] ${
              group.reactedByMe
                ? "border-accent/60 bg-accent/15 text-accent"
                : "border-border/60 bg-background/40 text-foreground hover:border-accent/40 hover:bg-card"
            }`}
            aria-pressed={group.reactedByMe}
            title={group.reactedByMe ? "Ta bort din reaktion" : "Lägg till reaktion"}
          >
            <span className="text-base leading-none">{emoji}</span>
            <span className="tabular-nums">{group.count}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-muted-foreground transition hover:border-accent/40 hover:bg-card hover:text-accent"
          title="Lägg till reaktion"
          aria-label="Lägg till reaktion"
        >
          <SmilePlus className="size-4" />
        </button>
      </div>

      {pickerOpen && (
        <div className="rounded-xl border border-border/60 bg-background/65 p-2 shadow-lg shadow-black/15">
          <div className="grid grid-cols-6 gap-1 sm:flex sm:flex-wrap">
            {QUICK_REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addReaction(emoji)}
                className="flex size-9 items-center justify-center rounded-lg text-lg transition hover:bg-secondary active:scale-95"
                aria-label={`Reagera med ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addReaction(customEmoji);
            }}
            className="mt-2 flex gap-1.5"
          >
            <input
              value={customEmoji}
              onChange={(event) => setCustomEmoji(event.target.value)}
              maxLength={32}
              placeholder="Valfri emoji"
              className="min-w-0 flex-1 rounded-lg border border-border bg-input px-2.5 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!customEmoji.trim()}
              className="rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              Lägg till
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function isEmojiReaction(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue || normalizedValue.length > 32) return false;
  const withoutEmojiParts = normalizedValue.replace(
    /[\p{Extended_Pictographic}\p{Emoji_Component}\uFE0F\u200D]/gu,
    "",
  );

  return withoutEmojiParts.length === 0 && /\p{Extended_Pictographic}/u.test(normalizedValue);
}

function AdminAnnouncementMini({
  announcement,
  onSelect,
}: {
  announcement: AdminAnnouncement;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group rounded-md border border-border/60 bg-card/45 px-2 py-1.5 text-left transition hover:border-accent/40 hover:bg-card/70 active:scale-[0.99]"
    >
      <div className="flex items-center gap-1.5">
        <div className="flex size-[18px] shrink-0 items-center justify-center rounded border border-accent/20 bg-accent/10 text-accent/80">
          <Pin className="size-2.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate font-sans text-[11px] font-bold leading-tight text-foreground group-hover:text-accent">
              {announcement.title}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] leading-none text-muted-foreground">
            {announcement.body}
          </p>
        </div>
      </div>
    </button>
  );
}

function getAnnouncementCutoff() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function formatAnnouncementExpiry(createdAt: string) {
  const expiresAt = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
  const hoursLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / (60 * 60 * 1000)));

  if (hoursLeft <= 0) return "Försvinner snart";
  return `${hoursLeft} h kvar`;
}

function formatPrizePot(amount: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function formatPreviousDayLabel(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function buildPredictionStats(predictions: PredictionWithMatch[]) {
  const stats: Record<string, { exact: number; points: number }> = {};

  for (const prediction of predictions) {
    const match = prediction.matches;
    if (!match || match.home_score === null || match.away_score === null) continue;

    const userStats = stats[prediction.user_id] ?? { exact: 0, points: 0 };
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

    stats[prediction.user_id] = userStats;
  }

  return stats;
}

function buildSideBetStats(answers: SideBetAnswer[]) {
  const stats: Record<string, { points: number }> = {};

  for (const answer of answers) {
    if (answer.points <= 0) continue;
    const userStats = stats[answer.user_id] ?? { points: 0 };
    userStats.points += answer.points;
    stats[answer.user_id] = userStats;
  }

  return stats;
}

function getSign(home: number, away: number) {
  if (home > away) return "1";
  if (home < away) return "2";
  return "X";
}
