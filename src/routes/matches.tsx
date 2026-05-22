import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { RequireCompletedEntry, useEntryCompletion } from "@/lib/entry-completion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, Clock, Check, ChevronDown, ChevronRight, Users } from "lucide-react";

export const Route = createFileRoute("/matches")({
  component: () => (
    <RequireCompletedEntry>
      <MatchesPage />
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

type Prediction = {
  match_id: string;
  predicted_home: number;
  predicted_away: number;
  points: number;
};

export function MatchesPage() {
  const { user, loading } = useAuth();
  const completion = useEntryCompletion();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [preds, setPreds] = useState<Record<string, Prediction>>({});
  const [lockTime, setLockTime] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [fetched, setFetched] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: m }, { data: p }] = await Promise.all([
        supabase.from("matches").select("*").order("kickoff"),
        supabase.from("predictions").select("match_id, predicted_home, predicted_away, points").eq("user_id", user.id),
      ]);
      const ms = (m ?? []) as Match[];
      setMatches(ms);
      setLockTime(ms.length ? new Date(ms[0].kickoff) : null);
      const map: Record<string, Prediction> = {};
      (p ?? []).forEach((x: any) => { map[x.match_id] = x; });
      setPreds(map);
      setFetched(true);
    })();
  }, [user]);

  const locked = !!(lockTime && now >= lockTime);
  const grouped = useMemo(() => {
    const g: Record<string, Match[]> = {};
    matches.forEach(m => { (g[m.group_name] ??= []).push(m); });
    return Object.entries(g).sort(([a],[b]) => a.localeCompare(b));
  }, [matches]);

  useEffect(() => {
    if (grouped.length === 0) return;
    setOpenGroups(current => {
      if (Object.keys(current).length > 0) return current;
      return { [grouped[0][0]]: true };
    });
  }, [grouped]);

  if (loading || !user) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {locked ? <Lock className="size-3.5" /> : <Clock className="size-3.5 text-accent" />}
          {locked ? "Tipsen är låsta" : "Tipsa innan turneringen startar"}
        </div>
        <h1 className="mt-1 font-display text-3xl">Gruppspelet</h1>
        {lockTime && (
          <p className="mt-1 text-sm text-muted-foreground">
            {locked ? "Avspark har gått — lycka till!" : <>Lås: <Countdown to={lockTime} now={now} /></>}
          </p>
        )}
      </section>

      {!completion.loading && !completion.isComplete && (
        <section className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm">
          <div className="font-semibold text-accent">Fyll i alla tips först</div>
          <p className="mt-1 text-muted-foreground">
            {completion.missingMatches > 0
              ? `${completion.missingMatches} matchtips kvar innan topplista och grupper låses upp.`
              : `${completion.missingSideBets} sidospel kvar innan topplista och grupper låses upp.`}
          </p>
          {completion.missingMatches === 0 && completion.missingSideBets > 0 && (
            <Link
              to="/sidebets"
              className="mt-3 inline-flex rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              Gå till sidospel
            </Link>
          )}
        </section>
      )}

      {fetched && matches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Inga matcher upplagda än.
        </div>
      )}

      {grouped.map(([group, ms]) => (
        <section key={group} className="space-y-3">
          <button
            type="button"
            onClick={() => setOpenGroups(current => ({ ...current, [group]: !current[group] }))}
            className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-left transition hover:bg-card"
          >
            <span className="font-display text-xl text-accent">Grupp {group}</span>
            <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {ms.length} matcher
              <ChevronDown className={`size-4 transition-transform ${openGroups[group] ? "rotate-180" : ""}`} />
            </span>
          </button>
          {openGroups[group] && (
            <div className="grid gap-2 md:grid-cols-2">
              {ms.map(m => (
                <MatchCard
                  key={m.id}
                  match={m}
                  pred={preds[m.id]}
                  locked={locked}
                  onSave={(p) => setPreds(s => ({ ...s, [m.id]: p }))}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Countdown({ to, now }: { to: Date; now: Date }) {
  const ms = Math.max(0, to.getTime() - now.getTime());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms / 3600000) % 24);
  const m = Math.floor((ms / 60000) % 60);
  return <span className="font-mono text-foreground">{d}d {h}h {m}m</span>;
}

function MatchCard({ match, pred, locked, onSave }: {
  match: Match; pred?: Prediction; locked: boolean;
  onSave: (p: Prediction) => void;
}) {
  const { user } = useAuth();
  const [home, setHome] = useState<string>(pred ? String(pred.predicted_home) : "");
  const [away, setAway] = useState<string>(pred ? String(pred.predicted_away) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pred) { setHome(String(pred.predicted_home)); setAway(String(pred.predicted_away)); }
  }, [pred]);

  const hasResult = match.home_score !== null && match.away_score !== null;
  const matchLocked = locked || hasResult;
  const kickoff = new Date(match.kickoff);
  const dateStr = kickoff.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
  const timeStr = kickoff.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  const canViewTips = isToday(match.kickoff);

  const save = async () => {
    if (!user) return;
    const h = parseInt(home), a = parseInt(away);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0 || h > 20 || a > 20) {
      toast.error("Ange giltigt resultat");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("predictions").upsert({
      user_id: user.id, match_id: match.id, predicted_home: h, predicted_away: a,
    }, { onConflict: "user_id,match_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Tips sparat");
      onSave({ match_id: match.id, predicted_home: h, predicted_away: a, points: pred?.points ?? 0 });
    }
  };

  const pointsBadge = pred && hasResult ? (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
      pred.points === 3 ? "bg-green-500 text-white"
      : pred.points === 1 ? "bg-accent text-accent-foreground"
      : "bg-destructive/20 text-destructive"
    }`}>+{pred.points}p</span>
  ) : null;

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{dateStr} · {timeStr}</span>
        <div className="flex items-center gap-1.5">
          {matchLocked && <Lock className="size-3" />}
          {pointsBadge}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="min-w-0 text-right text-sm font-semibold leading-tight">{match.home_team}</div>
        <div className="flex items-center gap-1">
          <ScoreInput value={home} onChange={setHome} disabled={matchLocked} />
          <span className="text-muted-foreground">–</span>
          <ScoreInput value={away} onChange={setAway} disabled={matchLocked} />
        </div>
        <div className="min-w-0 text-sm font-semibold leading-tight">{match.away_team}</div>
      </div>

      {hasResult && (
        <div className="mt-2 text-center text-xs text-muted-foreground">
          Slutresultat: <span className="font-bold text-foreground">{match.home_score}–{match.away_score}</span>
        </div>
      )}

      {!matchLocked && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
        >
          {pred ? <><Check className="size-4" /> Uppdatera tips</> : "Spara tips"}
        </button>
      )}

      {canViewTips && (
        <Link
          to="/matches/$matchId"
          params={{ matchId: match.id }}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/15 active:scale-[0.98]"
        >
          <Users className="size-4" />
          Se alla tips
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

function ScoreInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={20}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 w-10 rounded-md border border-border bg-input text-center text-base font-bold tabular-nums text-foreground outline-none focus:border-accent disabled:opacity-60"
      placeholder="–"
    />
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
