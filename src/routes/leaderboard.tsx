import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Trophy, Medal, Award } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
});

type Row = { user_id: string; username: string; total_points: number; exact_count: number; sign_count: number };

function LeaderboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const load = async () => {
    const { data } = await supabase.from("leaderboard").select("*");
    const sorted = ((data ?? []) as Row[]).sort((a, b) =>
      b.total_points - a.total_points || b.exact_count - a.exact_count
    );
    setRows(sorted);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("lb")
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Live</p>
        <h1 className="font-display text-3xl">Topplista</h1>
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
                {i === 0 ? <Trophy className="size-5 text-accent" />
                : i === 1 ? <Medal className="size-5 text-muted-foreground" />
                : i === 2 ? <Award className="size-5 text-accent/70" />
                : <span className="text-muted-foreground">{i + 1}</span>}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{r.username}</div>
                <div className="text-xs text-muted-foreground">
                  {r.exact_count} exakt · {r.sign_count} rätt tecken
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl text-accent">{r.total_points}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">poäng</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
