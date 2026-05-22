import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useEntryCompletion } from "@/lib/entry-completion";
import { MatchesPage } from "@/routes/matches";
import { SideBetsPage } from "@/routes/sidebets";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/entry")({
  component: EntryPage,
});

function EntryPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const completion = useEntryCompletion();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (authLoading || completion.loading || !user || isAdmin || !completion.isComplete) return;
    navigate({ to: "/", replace: true });
  }, [authLoading, completion.isComplete, completion.loading, isAdmin, navigate, user]);

  if (authLoading || completion.loading || !user) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-accent/30 bg-accent/10 p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <CheckCircle2 className="size-4 text-accent" /> Tippa klart
        </div>
        <h1 className="mt-1 font-display text-3xl">Lägg alla spel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Du låser upp hela appen när alla matchtips och sidospel är ifyllda.
        </p>
        {!completion.isComplete && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-background/50 px-3 py-1 text-muted-foreground">
              {completion.missingMatches} matchtips kvar
            </span>
            <span className="rounded-full bg-background/50 px-3 py-1 text-muted-foreground">
              {completion.missingSideBets} sidospel kvar
            </span>
          </div>
        )}
      </section>

      <MatchesPage />
      <SideBetsPage />
    </div>
  );
}
