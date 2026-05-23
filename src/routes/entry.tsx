import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useEntryCompletion } from "@/lib/entry-completion";
import { MatchesPage } from "@/routes/matches";
import { SideBetsPage } from "@/routes/sidebets";
import { CheckCircle2, Clock3, Send } from "lucide-react";

export const Route = createFileRoute("/entry")({
  component: EntryPage,
});

function EntryPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const completion = useEntryCompletion();
  const navigate = useNavigate();
  const displayName =
    user?.user_metadata?.username ??
    user?.user_metadata?.name ??
    (user?.email ? user.email.split("@")[0] : "");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, navigate, user]);

  if (authLoading || completion.loading || !user) return null;

  const submitEntry = () => {
    if (completion.isComplete) {
      toast.success("Tipsen är inlämnade");
      navigate({ to: "/", replace: true });
      return;
    }

    const missing = [
      completion.missingMatches > 0 ? `${completion.missingMatches} matchtips` : null,
      completion.missingSideBets > 0 ? `${completion.missingSideBets} sidospel` : null,
    ]
      .filter(Boolean)
      .join(" och ");

    toast.error(`Du saknar ${missing}.`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-accent/30 bg-accent/10 p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <CheckCircle2 className="size-4 text-accent" /> Tippa klart
        </div>
        <h1 className="mt-1 font-display text-3xl">Hej{displayName ? `, ${displayName}` : ""}</h1>
        <p className="mt-1 text-sm font-semibold text-foreground">Lägg alla spel</p>
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

      <section className="rounded-2xl border border-accent/30 bg-accent/10 p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {completion.isComplete ? (
            <CheckCircle2 className="size-4 text-accent" />
          ) : (
            <Clock3 className="size-4 text-accent" />
          )}
          Lämna in
        </div>
        <h2 className="mt-1 font-display text-2xl text-accent">
          {completion.isComplete ? "Allt är ifyllt" : "Du har tips kvar"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          När du lämnar in låses hela appen upp. Du kan fortfarande ändra matchtips och sidospel
          fram till 10 juni 2026 kl. 23:59.
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

        <button
          type="button"
          onClick={submitEntry}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.99]"
        >
          <Send className="size-4" />
          Lämna in tips
        </button>
      </section>
    </div>
  );
}
