import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TeamWithFlag } from "@/lib/flags";

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
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

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

      const [{ data: matchRows }, { data: predictionRows }] = await Promise.all([
        supabase
          .from("matches")
          .select("id, group_name, home_team, away_team, kickoff, home_score, away_score")
          .order("kickoff"),
        supabase
          .from("predictions")
          .select("match_id, predicted_home, predicted_away, points")
          .eq("user_id", userId),
      ]);

      const predictionsByMatch = new Map(
        ((predictionRows ?? []) as Prediction[]).map((prediction) => [
          prediction.match_id,
          prediction,
        ]),
      );
      const nextMatches = ((matchRows ?? []) as Match[]).map((match) => ({
        ...match,
        prediction: predictionsByMatch.get(match.id),
      }));

      setMatches(nextMatches);
      setSelectedMatchId((current) => current ?? nextMatches[0]?.id ?? null);
      setFetched(true);
    })();
  }, [canView, user, userId]);

  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? null;
  const totalPoints = matches.reduce((sum, match) => sum + (match.prediction?.points ?? 0), 0);
  const predictionCount = matches.filter((match) => match.prediction).length;

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
          Matchruta 1 är tidigaste matchen, sedan fortsätter schemat i spelordning.
        </p>
      </section>

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
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="min-w-0 text-right text-sm font-semibold">
          <TeamWithFlag team={match.home_team} align="right" />
        </div>
        <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-2 font-display text-3xl leading-none text-accent">
          {prediction ? `${prediction.predicted_home}-${prediction.predicted_away}` : "-"}
        </div>
        <div className="min-w-0 text-sm font-semibold">
          <TeamWithFlag team={match.away_team} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <DetailStat
          label="Tips"
          value={prediction ? `${prediction.predicted_home}-${prediction.predicted_away}` : "-"}
        />
        <DetailStat label="Poäng" value={prediction ? `${prediction.points}p` : "-"} />
        <DetailStat
          label="Slutresultat"
          value={hasResult ? `${match.home_score}-${match.away_score}` : "-"}
        />
      </div>

      <div
        className={`mt-3 rounded-lg px-3 py-2 text-center text-xs font-semibold ${status.badge}`}
      >
        {status.label}
      </div>
    </section>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/45 px-2 py-2">
      <div className="truncate text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-xl leading-none text-foreground">{value}</div>
    </div>
  );
}

function getMatchTone(match: CalendarMatch) {
  if (!match.prediction) return "bg-muted text-muted-foreground";
  if (match.prediction.points === 3) return "bg-green-500";
  if (match.prediction.points === 1) return "bg-yellow-400";
  if (match.home_score === null || match.away_score === null) return "bg-secondary text-foreground";
  return "bg-red-500";
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
