import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TeamWithFlag } from "@/lib/flags";
import { ChevronDown, Flame, ShieldAlert, ShieldCheck } from "lucide-react";

type Match = {
  id: string;
  group_name: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
};

type ManualEntryCategory = "top_scorers" | "top_assists" | "red_cards";

type ManualEntry = {
  id: string;
  category: ManualEntryCategory;
  label: string;
  value: number;
};

type TeamStat = {
  team: string;
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
};

const db = supabase as any;

const MANUAL_CATEGORIES: Array<{
  category: ManualEntryCategory;
  title: string;
  valueLabel: string;
}> = [
  { category: "top_scorers", title: "Skytteliga", valueLabel: "mål" },
  { category: "top_assists", title: "Assistliga", valueLabel: "assist" },
  { category: "red_cards", title: "Röda kort totalt", valueLabel: "kort" },
];

function getRowsForCategory(rows: ManualEntry[], category: ManualEntryCategory) {
  const filtered = rows.filter((row) => row.category === category);
  if (category !== "red_cards") {
    return filtered.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "sv-SE"));
  }

  if (filtered.length === 0) return [];
  const total = filtered.reduce((sum, row) => sum + row.value, 0);
  return [{ ...filtered[0], label: "Totalt", value: total }];
}

export function SideBetsLiveBoard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [manualEntriesAvailable, setManualEntriesAvailable] = useState(true);

  const load = async () => {
    const { data: matchRows, error: matchesError } = await supabase
      .from("matches")
      .select("id, group_name, home_team, away_team, home_score, away_score");

    if (!matchesError) {
      setMatches((matchRows ?? []) as Match[]);
    }

    const { data: manualRows, error: manualError } = await db
      .from("sidebet_live_manual_entries")
      .select("id, category, label, value");

    if (manualError) {
      if ((manualError as { code?: string }).code === "42P01") {
        setManualEntriesAvailable(false);
        setManualEntries([]);
        return;
      }
      return;
    }

    setManualEntriesAvailable(true);
    setManualEntries((manualRows ?? []) as ManualEntry[]);
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 5000);
    const ch = supabase
      .channel("sidebets-live-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "sidebet_live_manual_entries" }, load)
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, []);

  const { topScoringTeams, topConcedingTeams, topLeastConcedingTeams } = useMemo(() => {
    const resolved = matches.filter(
      (match) => match.home_score !== null && match.away_score !== null,
    );
    const resolvedGroupStage = resolved.filter((match) => isGroupStageMatch(match.group_name));

    const map = new Map<string, TeamStat>();

    const ensure = (team: string) => {
      if (!map.has(team)) {
        map.set(team, {
          team,
          played: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDiff: 0,
        });
      }
      return map.get(team)!;
    };

    for (const match of resolvedGroupStage) {
      const home = ensure(match.home_team);
      const away = ensure(match.away_team);
      const homeGoals = match.home_score ?? 0;
      const awayGoals = match.away_score ?? 0;

      home.played += 1;
      away.played += 1;

      home.goalsFor += homeGoals;
      home.goalsAgainst += awayGoals;
      away.goalsFor += awayGoals;
      away.goalsAgainst += homeGoals;
    }

    const rows = Array.from(map.values()).map((row) => ({
      ...row,
      goalDiff: row.goalsFor - row.goalsAgainst,
    }));

    const byScored = [...rows].sort(
      (a, b) => b.goalsFor - a.goalsFor || b.goalDiff - a.goalDiff || a.team.localeCompare(b.team, "sv-SE"),
    );
    const byConceded = [...rows].sort(
      (a, b) => b.goalsAgainst - a.goalsAgainst || a.team.localeCompare(b.team, "sv-SE"),
    );
    const byLeastConceded = [...rows].sort(
      (a, b) => a.goalsAgainst - b.goalsAgainst || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team, "sv-SE"),
    );

    return {
      topScoringTeams: byScored.slice(0, 3),
      topConcedingTeams: byConceded.slice(0, 3),
      topLeastConcedingTeams: byLeastConceded.slice(0, 3),
    };
  }, [matches]);

  const groupedManual = useMemo(() => {
    const grouped: Record<ManualEntryCategory, ManualEntry[]> = {
      top_scorers: [],
      top_assists: [],
      red_cards: [],
    };

    for (const entry of manualEntries) grouped[entry.category].push(entry);

    (Object.keys(grouped) as ManualEntryCategory[]).forEach((key) => {
      grouped[key].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "sv-SE"));
    });

    return grouped;
  }, [manualEntries]);

  const topManualCategories = MANUAL_CATEGORIES.filter((config) => config.category !== "red_cards");
  const redCardsCategory = MANUAL_CATEGORIES.find((config) => config.category === "red_cards")!;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Sidospel</p>
        <h2 className="mt-1 font-display text-2xl text-accent">Statistik för sidospel</h2>
      </section>

      <section className="space-y-3">
        {!manualEntriesAvailable && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Tabellerna är inte aktiverade i databasen ännu.
          </div>
        )}
        <div className="space-y-3">
          {topManualCategories.map((config) => (
            <ManualCategoryTable
              key={config.category}
              category={config.category}
              title={config.title}
              valueLabel={config.valueLabel}
              rows={getRowsForCategory(groupedManual[config.category], config.category)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <TeamMetricTable
          title="Landet med flest gjorda mål"
          icon={<Flame className="size-4 text-accent" />}
          rows={topScoringTeams}
          valueKey="goalsFor"
          valueLabel="mål"
        />
        <TeamMetricTable
          title="Landet med flest insläppta mål"
          icon={<ShieldAlert className="size-4 text-accent" />}
          rows={topConcedingTeams}
          valueKey="goalsAgainst"
          valueLabel="insläppta"
        />
        <TeamMetricTable
          title="Landet med minst insläppta mål"
          icon={<ShieldCheck className="size-4 text-accent" />}
          rows={topLeastConcedingTeams}
          valueKey="goalsAgainst"
          valueLabel="insläppta"
          ascending
        />
      </section>

      <section className="space-y-3">
        <ManualCategoryTable
          category={redCardsCategory.category}
          title={redCardsCategory.title}
          valueLabel={redCardsCategory.valueLabel}
          rows={getRowsForCategory(groupedManual[redCardsCategory.category], redCardsCategory.category)}
        />
      </section>
    </div>
  );
}

function TeamMetricTable({
  title,
  icon,
  rows,
  valueKey,
  valueLabel,
  ascending = false,
}: {
  title: string;
  icon: React.ReactNode;
  rows: TeamStat[];
  valueKey: "goalsFor" | "goalsAgainst";
  valueLabel: string;
  ascending?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur">
      <h3 className="flex items-center gap-2 font-display text-lg text-accent">
        {icon} {title}
      </h3>

      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">Inga avgjorda matcher än.</div>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {rows.map((row, index) => (
            <li key={row.team} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-2.5 py-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-accent">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1 text-sm font-medium">
                <TeamWithFlag team={row.team} wrap />
              </div>
              <div className={`text-sm font-semibold ${ascending ? "text-emerald-400" : "text-accent"}`}>
                {row[valueKey]} {valueLabel}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ManualCategoryTable({
  category,
  title,
  valueLabel,
  rows,
}: {
  category: ManualEntryCategory;
  title: string;
  valueLabel: string;
  rows: ManualEntry[];
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = category !== "red_cards" && rows.length > 5;
  const visibleRows = canExpand && !expanded ? rows.slice(0, 5) : rows;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur">
      <h4 className="font-display text-lg text-accent">{title}</h4>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          Inga rader ännu.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <ol className="space-y-1.5">
            {visibleRows.map((row, index) => (
              <li
                key={row.id}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-2.5 py-2"
              >
                {category === "red_cards" ? (
                  <div
                    aria-hidden
                    className="h-5 w-3 shrink-0 rounded-[2px] border border-red-700 bg-red-500"
                  />
                ) : (
                  <div className="flex size-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-accent">
                    {index + 1}
                  </div>
                )}
                <div className="min-w-0 flex-1 break-words text-sm font-medium">
                  {category === "red_cards" ? "Röda kort totalt:" : row.label}
                </div>
                <div className="text-sm font-semibold text-accent">
                  {row.value} {valueLabel}
                </div>
              </li>
            ))}
          </ol>
          {canExpand && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/20 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-accent/40 hover:text-accent"
            >
              {expanded ? "Visa topp 5" : `Visa alla (${rows.length})`}
              <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

const GROUP_STAGE_NAMES = new Set(["A", "B", "C", "D", "E", "F", "G", "H"]);

function isGroupStageMatch(groupName: string) {
  return GROUP_STAGE_NAMES.has((groupName ?? "").trim().toUpperCase());
}
