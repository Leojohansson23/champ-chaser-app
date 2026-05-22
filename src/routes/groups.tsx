import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/groups")({
  component: GroupsPage,
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

type TeamRow = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

function GroupsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const load = async () => {
    const { data } = await supabase.from("matches").select("*").order("kickoff");
    setMatches((data ?? []) as Match[]);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const interval = window.setInterval(load, 5000);
    window.addEventListener("focus", load);
    const ch = supabase
      .channel("group-standings")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .subscribe();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      supabase.removeChannel(ch);
    };
  }, [user]);

  const groups = useMemo(() => buildGroupTables(matches), [matches]);

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Live</p>
        <h1 className="font-display text-3xl">Grupper</h1>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Inga matcher upplagda an.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([group, rows]) => (
            <section key={group} className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur">
              <div className="mb-3 flex items-end justify-between">
                <h2 className="font-display text-xl text-accent">Grupp {group}</h2>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {rows.reduce((sum, row) => sum + row.played, 0) / 2} spelade
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="w-8 py-2 text-left">#</th>
                      <th className="py-2 text-left">Lag</th>
                      <th className="py-2 text-center">S</th>
                      <th className="py-2 text-center">V</th>
                      <th className="py-2 text-center">O</th>
                      <th className="py-2 text-center">F</th>
                      <th className="py-2 text-center">GM</th>
                      <th className="py-2 text-center">IM</th>
                      <th className="py-2 text-center">MS</th>
                      <th className="py-2 text-right">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.team} className="border-b border-border/30 last:border-0">
                        <td className="py-2 text-muted-foreground">{index + 1}</td>
                        <td className="py-2 font-semibold">{row.team}</td>
                        <td className="py-2 text-center text-muted-foreground">{row.played}</td>
                        <td className="py-2 text-center text-muted-foreground">{row.won}</td>
                        <td className="py-2 text-center text-muted-foreground">{row.drawn}</td>
                        <td className="py-2 text-center text-muted-foreground">{row.lost}</td>
                        <td className="py-2 text-center text-muted-foreground">{row.goalsFor}</td>
                        <td className="py-2 text-center text-muted-foreground">{row.goalsAgainst}</td>
                        <td className="py-2 text-center text-muted-foreground">{formatGoalDiff(row.goalDiff)}</td>
                        <td className="py-2 text-right font-display text-lg text-accent">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function buildGroupTables(matches: Match[]) {
  const grouped = new Map<string, Match[]>();
  for (const match of matches) {
    const groupMatches = grouped.get(match.group_name) ?? [];
    groupMatches.push(match);
    grouped.set(match.group_name, groupMatches);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, groupMatches]) => [group, buildRows(groupMatches)] as const);
}

function buildRows(matches: Match[]) {
  const teams = new Map<string, TeamRow>();
  const getTeam = (team: string) => {
    const existing = teams.get(team);
    if (existing) return existing;
    const row: TeamRow = {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    };
    teams.set(team, row);
    return row;
  };

  for (const match of matches) {
    const home = getTeam(match.home_team);
    const away = getTeam(match.away_team);

    if (match.home_score === null || match.away_score === null) continue;

    applyResult(home, match.home_score, match.away_score);
    applyResult(away, match.away_score, match.home_score);
  }

  return Array.from(teams.values()).sort((a, b) =>
    b.points - a.points ||
    b.goalDiff - a.goalDiff ||
    b.goalsFor - a.goalsFor ||
    a.team.localeCompare(b.team)
  );
}

function applyResult(row: TeamRow, goalsFor: number, goalsAgainst: number) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDiff = row.goalsFor - row.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    row.won += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.drawn += 1;
    row.points += 1;
  } else {
    row.lost += 1;
  }
}

function formatGoalDiff(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
