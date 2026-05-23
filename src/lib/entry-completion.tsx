import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type EntryCompletion = {
  loading: boolean;
  matchCount: number;
  predictionCount: number;
  sideBetCount: number;
  sideBetAnswerCount: number;
  missingMatches: number;
  missingSideBets: number;
  isComplete: boolean;
  nextRequiredPath: "/entry";
};

const initialState: EntryCompletion = {
  loading: true,
  matchCount: 0,
  predictionCount: 0,
  sideBetCount: 0,
  sideBetAnswerCount: 0,
  missingMatches: 0,
  missingSideBets: 0,
  isComplete: false,
  nextRequiredPath: "/entry",
};

export function useEntryCompletion() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [state, setState] = useState<EntryCompletion>(initialState);
  const channelId = useRef(crypto.randomUUID());
  const db = supabase as any;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState(initialState);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const [
        { count: matchCount },
        { count: predictionCount },
        { count: sideBetCount },
        { count: sideBetAnswerCount },
      ] = await Promise.all([
        supabase.from("matches").select("id", { count: "exact", head: true }),
        supabase.from("predictions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        db.from("side_bets").select("id", { count: "exact", head: true }),
        db.from("side_bet_answers").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      if (cancelled) return;

      const matches = matchCount ?? 0;
      const predictions = predictionCount ?? 0;
      const sideBets = sideBetCount ?? 0;
      const sideBetAnswers = sideBetAnswerCount ?? 0;
      const missingMatches = Math.max(0, matches - predictions);
      const missingSideBets = Math.max(0, sideBets - sideBetAnswers);

      setState({
        loading: false,
        matchCount: matches,
        predictionCount: predictions,
        sideBetCount: sideBets,
        sideBetAnswerCount: sideBetAnswers,
        missingMatches,
        missingSideBets,
        isComplete: missingMatches === 0 && missingSideBets === 0,
        nextRequiredPath: "/entry",
      });
    };

    load();
    const interval = window.setInterval(load, 5000);
    window.addEventListener("focus", load);
    const ch = supabase
      .channel(`entry-completion-${user.id}-${channelId.current}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "side_bets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "side_bet_answers", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      supabase.removeChannel(ch);
    };
  }, [authLoading, db, user]);

  return useMemo(() => ({
    ...state,
    isComplete: isAdmin || state.isComplete,
  }), [isAdmin, state]);
}

export function RequireCompletedEntry({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const completion = useEntryCompletion();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (completion.loading || completion.isComplete) return;
    navigate({ to: completion.nextRequiredPath, replace: true });
  }, [authLoading, completion.isComplete, completion.loading, completion.nextRequiredPath, navigate, user]);

  if (!user || authLoading || completion.loading || !completion.isComplete) return null;

  return <>{children}</>;
}
