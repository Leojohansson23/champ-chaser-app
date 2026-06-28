import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, ListChecks, Lock, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TeamWithFlag } from "@/lib/flags";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/users_/$userId")({
  component: UserPredictionsPage,
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

type Prediction = {
  match_id: string;
  predicted_home: number;
  predicted_away: number;
  points: number;
};

type CalendarMatch = Match & {
  prediction?: Prediction;
};

type SideBet = {
  id: string;
  question: string;
  options: string[];
  points: number;
  deadline: string;
  correct_answer: string | null;
};

type SideBetAnswer = {
  side_bet_id: string;
  answer: string;
  points: number;
};

type DisplaySideBet = SideBet & {
  answer?: SideBetAnswer;
};

type Profile = {
  id: string;
  username: string;
};

const MATCH_PREDICTION_DEADLINE = new Date("2026-06-10T23:59:00+02:00");

function UserPredictionsPage() {
  const { user, isAdmin, loading } = useAuth();
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<CalendarMatch[]>([]);
  const [sideBets, setSideBets] = useState<DisplaySideBet[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const db = supabase as any;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  const canView =
    !!user && (isAdmin || user.id === userId || new Date() >= MATCH_PREDICTION_DEADLINE);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("id", userId)
        .maybeSingle();
      setProfile((profileRow ?? null) as Profile | null);

      if (!canView) {
        setFetched(true);
        return;
      }

      const [
        { data: matchRows },
        { data: predictionRows },
        { data: sideBetRows },
        { data: answerRows },
      ] = await Promise.all([
        supabase
          .from("matches")
          .select(
            "id, group_name, home_team, away_team, kickoff, home_score, away_score, city, stadium",
          )
          .order("kickoff"),
        supabase
          .from("predictions")
          .select("match_id, predicted_home, predicted_away, points")
          .eq("user_id", userId),
        db
          .from("side_bets")
          .select("id, question, options, points, deadline, correct_answer")
          .order("deadline"),
        db.from("side_bet_answers").select("side_bet_id, answer, points").eq("user_id", userId),
      ]);

      const predictionsByMatch = new Map(
        ((predictionRows ?? []) as Prediction[]).map((prediction) => [
          prediction.match_id,
          prediction,
        ]),
      );
      const answersByBet = new Map(
        ((answerRows ?? []) as SideBetAnswer[]).map((answer) => [answer.side_bet_id, answer]),
      );
      const nextMatches = ((matchRows ?? []) as Match[]).map((match) => ({
        ...match,
        prediction: predictionsByMatch.get(match.id),
      }));

      setMatches(nextMatches);
      setSideBets(
        ((sideBetRows ?? []) as SideBet[]).map((bet) => ({
          ...bet,
          answer: answersByBet.get(bet.id),
        })),
      );
      setSelectedMatchId((current) => current ?? nextMatches[0]?.id ?? null);
      setFetched(true);
    })();
  }, [canView, db, user, userId]);

  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? null;
  const matchPoints = matches.reduce((sum, match) => sum + (match.prediction?.points ?? 0), 0);
  const sideBetPoints = sideBets.reduce((sum, bet) => sum + (bet.answer?.points ?? 0), 0);
  const totalPoints = matchPoints + sideBetPoints;
  const predictionCount = matches.filter((match) => match.prediction).length;
  const sideBetAnswerCount = sideBets.filter((bet) => bet.answer).length;

  if (loading || !user) return null;

  if (!canView) {
    return (
      <div className="space-y-5">
        <section className="rounded-2xl border border-border/60 bg-card/60 p-5 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Lock className="size-5" />
          </div>
          <h1 className="mt-3 font-display text-2xl">Tipsen är låsta tills deadline</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Du kan se andra deltagares tips efter 10 juni 2026 kl. 23:59. Admin kan se tipsen hela
            tiden.
          </p>
          <Link
            to="/leaderboard"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Till topplistan
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Deltagare</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h1 className="min-w-0 truncate font-display text-3xl">
            {profile?.username ?? "Deltagare"}
          </h1>
          <div className="shrink-0 text-right">
            <div className="font-display text-3xl leading-none text-accent">{totalPoints}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">poäng</div>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {predictionCount} matchtips och {sideBetAnswerCount} sidospel registrerade.
        </p>
      </section>

      <Tabs defaultValue="matches" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2">
          <TabsTrigger value="matches" className="gap-1.5">
            <ListChecks className="size-4" /> Matcher
          </TabsTrigger>
          <TabsTrigger value="sidebets" className="gap-1.5">
            <Target className="size-4" /> Sidospel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="mt-0 space-y-5">
          {selectedMatch && <SelectedMatchDetails match={selectedMatch} />}

          {fetched && matches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Inga matcher att visa.
            </div>
          ) : (
            <section className="rounded-2xl border border-border/60 bg-card/60 p-3">
              <h2 className="mb-3 flex items-center gap-2 px-1 font-display text-xl text-accent">
                <CalendarDays className="size-5" />
                Matchkalender
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                {matches.map((match, index) => (
                  <MatchCalendarTile
                    key={match.id}
                    match={match}
                    number={index + 1}
                    selected={selectedMatchId === match.id}
                    onSelect={setSelectedMatchId}
                  />
                ))}
              </div>
            </section>
          )}
        </TabsContent>

        <TabsContent value="sidebets" className="mt-0">
          <UserSideBets sideBets={sideBets} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatchCalendarTile({
  match,
  number,
  selected,
  onSelect,
}: {
  match: CalendarMatch;
  number: number;
  selected: boolean;
  onSelect: (matchId: string) => void;
}) {
  const prediction = match.prediction;
  const hasResult = match.home_score !== null && match.away_score !== null;
  const kickoff = new Date(match.kickoff);

  return (
    <button
      type="button"
      onClick={() => onSelect(match.id)}
      className={`min-h-28 rounded-xl border p-2 text-left shadow-sm transition hover:border-accent/60 active:scale-[0.99] ${
        selected
          ? "border-accent ring-2 ring-accent ring-offset-1 ring-offset-background"
          : "border-border/60"
      } ${getTileStyle(match).card}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Match {number}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {kickoff.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })} ·{" "}
            {kickoff.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div
          className={`flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${getTileStyle(match).badge}`}
        >
          {prediction ? `${prediction.points}p` : "-"}
        </div>
      </div>

      <div className="mt-2 min-w-0 space-y-1">
        <div className="min-w-0 text-[11px] font-semibold">
          <TeamWithFlag
            team={match.home_team}
            flagClassName="h-2.5 w-4"
            className="min-w-0"
            textClassName="truncate"
          />
        </div>
        <div className="min-w-0 text-[11px] font-semibold">
          <TeamWithFlag
            team={match.away_team}
            flagClassName="h-2.5 w-4"
            className="min-w-0"
            textClassName="truncate"
          />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1 text-center">
        <div className="min-w-0 rounded-md border border-border/40 bg-background/45 px-1 py-1">
          <div className="truncate text-[7px] uppercase tracking-normal text-muted-foreground">
            Tips
          </div>
          <div className="font-display text-lg leading-none text-accent">
            {prediction ? `${prediction.predicted_home}-${prediction.predicted_away}` : "-"}
          </div>
        </div>
        <div className="min-w-0 rounded-md border border-border/40 bg-background/45 px-1 py-1">
          <div className="truncate text-[7px] uppercase tracking-normal text-muted-foreground">
            Resultat
          </div>
          <div className="font-display text-lg leading-none text-foreground">
            {hasResult ? `${match.home_score}-${match.away_score}` : "-"}
          </div>
        </div>
      </div>
    </button>
  );
}

function SelectedMatchDetails({ match }: { match: CalendarMatch }) {
  const prediction = match.prediction;
  const hasResult = match.home_score !== null && match.away_score !== null;
  const status = getStatusMeta(match);
  const venue = [match.city, match.stadium].filter(Boolean).join(" · ");

  return (
    <section className={`rounded-2xl border bg-card/60 p-4 ${status.card}`}>
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Grupp {match.group_name}</span>
        <span>
          {new Date(match.kickoff).toLocaleString("sv-SE", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {venue && (
        <div className="mt-2 truncate text-center text-xs font-medium text-muted-foreground">
          {venue}
        </div>
      )}
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="min-w-0 text-right text-sm font-semibold">
          <TeamWithFlag team={match.home_team} align="right" />
        </div>
        <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-2 text-center">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Slutresultat
          </div>
          <div className="font-display text-3xl leading-none text-foreground">
            {hasResult ? `${match.home_score}-${match.away_score}` : "-"}
          </div>
        </div>
        <div className="min-w-0 text-sm font-semibold">
          <TeamWithFlag team={match.away_team} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <DetailStat
          label="Tips"
          value={prediction ? `${prediction.predicted_home}-${prediction.predicted_away}` : "-"}
        />
        <DetailStat label="Poäng" value={prediction ? `${prediction.points}p` : "-"} />
      </div>

      <div
        className={`mt-3 rounded-lg px-3 py-2 text-center text-xs font-semibold ${status.badge}`}
      >
        {status.label}
      </div>
    </section>
  );
}

function UserSideBets({ sideBets }: { sideBets: DisplaySideBet[] }) {
  if (sideBets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Inga sidospel att visa.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-3">
      <h2 className="mb-3 flex items-center gap-2 px-1 font-display text-xl text-accent">
        <Target className="size-5" />
        Sidospel
      </h2>
      <div className="space-y-2">
        {sideBets.map((bet, index) => (
          <SideBetResultCard key={bet.id} bet={bet} number={index + 1} />
        ))}
      </div>
    </section>
  );
}

function SideBetResultCard({ bet, number }: { bet: DisplaySideBet; number: number }) {
  const resolved = bet.correct_answer !== null;
  const answer = bet.answer;
  const status = getSideBetStatus(bet);

  return (
    <article className={`rounded-xl border bg-background/35 p-3 ${status.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sidospel {number}
          </div>
          <h3 className="mt-1 font-display text-xl leading-tight">{bet.question}</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {bet.points} bonuspoäng · Stänger {formatDeadline(bet.deadline)}
          </div>
        </div>
        <div className={`shrink-0 rounded-md px-2.5 py-1 font-display text-lg ${status.badge}`}>
          {answer ? `${answer.points}p` : "-"}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <DetailStat className={status.answerStat} label="Svar" value={answer?.answer ?? "-"} />
        <DetailStat
          label="Rätt svar"
          value={resolved ? formatCorrectAnswers(bet.correct_answer) : "-"}
        />
      </div>

      <div className={`mt-3 rounded-lg px-3 py-2 text-center text-xs font-semibold ${status.note}`}>
        {status.label}
      </div>
    </article>
  );
}

function DetailStat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border/60 bg-background/45 px-2 py-2 ${className}`}>
      <div className="truncate text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words font-display text-xl leading-none text-foreground">
        {value}
      </div>
    </div>
  );
}

function getTileStyle(match: CalendarMatch) {
  if (!match.prediction || match.home_score === null || match.away_score === null) {
    return {
      card: "bg-card/60 text-foreground",
      badge: "bg-secondary text-muted-foreground",
    };
  }

  if (match.prediction.points === 3) {
    return {
      card: "border-green-500/45 bg-green-500/10 text-foreground shadow-[inset_2px_0_0_rgba(34,197,94,0.85)]",
      badge: "bg-green-500 text-white",
    };
  }

  if (match.prediction.points === 1) {
    return {
      card: "border-yellow-500/45 bg-yellow-500/10 text-foreground shadow-[inset_2px_0_0_rgba(234,179,8,0.9)]",
      badge: "bg-yellow-500 text-black",
    };
  }

  return {
    card: "border-red-500/40 bg-red-500/10 text-foreground shadow-[inset_2px_0_0_rgba(239,68,68,0.85)]",
    badge: "bg-red-500 text-white",
  };
}

function getStatusMeta(match: CalendarMatch) {
  if (!match.prediction) {
    return {
      label: "Inget tips sparat",
      card: "border-border/60",
      badge: "bg-secondary text-muted-foreground",
    };
  }

  if (match.home_score === null || match.away_score === null) {
    return {
      label: "Väntar på slutresultat",
      card: "border-border/60",
      badge: "bg-secondary text-muted-foreground",
    };
  }

  if (match.prediction.points === 3) {
    return {
      label: "Rätt resultat",
      card: "border-green-500/45 shadow-[inset_2px_0_0_rgba(34,197,94,0.85)]",
      badge: "bg-green-500/15 text-green-300",
    };
  }

  if (match.prediction.points === 1) {
    return {
      label: "Rätt 1X2",
      card: "border-yellow-500/45 shadow-[inset_2px_0_0_rgba(234,179,8,0.9)]",
      badge: "bg-yellow-500/15 text-yellow-300",
    };
  }

  return {
    label: "Fel",
    card: "border-red-500/40 shadow-[inset_2px_0_0_rgba(239,68,68,0.85)]",
    badge: "bg-red-500/15 text-red-300",
  };
}

function getSideBetStatus(bet: DisplaySideBet) {
  if (!bet.answer) {
    return {
      label: "Inget svar sparat",
      card: "border-border/60",
      badge: "bg-secondary text-muted-foreground",
      note: "bg-secondary text-muted-foreground",
      answerStat: "",
    };
  }

  if (bet.correct_answer === null) {
    return {
      label: "Väntar på rätt svar",
      card: "border-border/60",
      badge: "bg-secondary text-muted-foreground",
      note: "bg-secondary text-muted-foreground",
      answerStat: "",
    };
  }

  if (bet.answer.points > 0) {
    return {
      label: "Rätt sidospel",
      card: "border-green-500/45 shadow-[inset_2px_0_0_rgba(34,197,94,0.85)]",
      badge: "bg-green-500 text-white",
      note: "bg-green-500/15 text-green-300",
      answerStat: "border-green-500/45 bg-green-500/15 text-green-200",
    };
  }

  return {
    label: "Fel sidospel",
    card: "border-red-500/40 shadow-[inset_2px_0_0_rgba(239,68,68,0.85)]",
    badge: "bg-red-500 text-white",
    note: "bg-red-500/15 text-red-300",
    answerStat: "border-red-500/45 bg-red-500/15 text-red-200",
  };
}

function formatDeadline(deadline: string) {
  return new Date(deadline).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}

function formatCorrectAnswers(correctAnswer: string | null) {
  return (
    (correctAnswer ?? "")
      .split(/[,;|\n]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ") || "-"
  );
}
