import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RequireCompletedEntry, useEntryCompletion } from "@/lib/entry-completion";
import { toast } from "sonner";
import { Check, Lock, Save } from "lucide-react";

export const Route = createFileRoute("/sidebets")({
  component: () => (
    <RequireCompletedEntry>
      <SideBetsPage />
    </RequireCompletedEntry>
  ),
});

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

export function SideBetsPage() {
  const { user, loading } = useAuth();
  const completion = useEntryCompletion();
  const navigate = useNavigate();
  const [bets, setBets] = useState<SideBet[]>([]);
  const [answers, setAnswers] = useState<Record<string, SideBetAnswer>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const db = supabase as any;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const load = async () => {
    if (!user) return;
    const [{ data: sideBets }, { data: sideBetAnswers }] = await Promise.all([
      db.from("side_bets").select("*").order("deadline"),
      db.from("side_bet_answers").select("side_bet_id, answer, points").eq("user_id", user.id),
    ]);

    const answerMap: Record<string, SideBetAnswer> = {};
    ((sideBetAnswers ?? []) as SideBetAnswer[]).forEach(answer => {
      answerMap[answer.side_bet_id] = answer;
    });
    setBets((sideBets ?? []) as SideBet[]);
    setAnswers(answerMap);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const interval = window.setInterval(load, 5000);
    window.addEventListener("focus", load);
    const ch = supabase
      .channel("sidebets")
      .on("postgres_changes", { event: "*", schema: "public", table: "side_bets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "side_bet_answers" }, load)
      .subscribe();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      supabase.removeChannel(ch);
    };
  }, [user]);

  const grouped = useMemo(() => ({
    open: bets.filter(bet => !isLocked(bet)),
    locked: bets.filter(bet => isLocked(bet)),
  }), [bets]);

  if (!user) return null;

  const saveAnswer = async (bet: SideBet, answer: string) => {
    setSaving(bet.id);
    const { error } = await db.from("side_bet_answers").upsert({
      side_bet_id: bet.id,
      user_id: user.id,
      answer,
    }, { onConflict: "side_bet_id,user_id" });
    setSaving(null);

    if (error) toast.error(error.message);
    else {
      toast.success("Sidospel sparat");
      setAnswers(current => ({ ...current, [bet.id]: { side_bet_id: bet.id, answer, points: 0 } }));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Bonus</p>
        <h1 className="font-display text-3xl">Sidospel</h1>
      </div>

      {!completion.loading && !completion.isComplete && (
        <section className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm">
          <div className="font-semibold text-accent">Fyll i alla tips först</div>
          <p className="mt-1 text-muted-foreground">
            {completion.missingMatches > 0
              ? `${completion.missingMatches} matchtips kvar.`
              : `${completion.missingSideBets} sidospel kvar innan topplista och grupper låses upp.`}
          </p>
        </section>
      )}

      {bets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Inga sidospel upplagda än.
        </div>
      ) : (
        <>
          {grouped.open.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-xl text-accent">Öppna</h2>
              {grouped.open.map(bet => (
                <SideBetCard
                  key={bet.id}
                  bet={bet}
                  answer={answers[bet.id]}
                  saving={saving === bet.id}
                  onAnswer={saveAnswer}
                />
              ))}
            </section>
          )}

          {grouped.locked.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-xl text-accent">Låsta</h2>
              {grouped.locked.map(bet => (
                <SideBetCard
                  key={bet.id}
                  bet={bet}
                  answer={answers[bet.id]}
                  saving={false}
                  onAnswer={saveAnswer}
                />
              ))}
            </section>
          )}

          <section className="space-y-3">
            <h2 className="font-display text-xl text-accent">Dina sidospel-svar</h2>
            <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
              <div className="space-y-2">
                {bets.map((bet) => {
                  const answer = answers[bet.id];
                  const status = answer ? "Svarat" : "Ej svarat";
                  return (
                    <div key={bet.id} className="rounded-lg border border-border/60 bg-background/30 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium">{bet.question}</div>
                        <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Ditt svar: <span className="font-semibold text-foreground">{answer?.answer ?? "-"}</span>
                        {answer ? <span> · {answer.points}p</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SideBetCard({ bet, answer, saving, onAnswer }: {
  bet: SideBet;
  answer?: SideBetAnswer;
  saving: boolean;
  onAnswer: (bet: SideBet, answer: string) => void;
}) {
  const locked = isLocked(bet);
  const resolved = bet.correct_answer !== null;
  const hasOptions = bet.options.length > 0;
  const [textAnswer, setTextAnswer] = useState(answer?.answer ?? "");

  useEffect(() => {
    setTextAnswer(answer?.answer ?? "");
  }, [answer?.answer]);

  return (
    <div className={`rounded-2xl border p-4 backdrop-blur ${getSideBetCardStyle(bet, answer)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{bet.question}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {bet.points} bonuspoäng · Stänger {formatDeadline(bet.deadline)}
          </div>
        </div>
        {locked && <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      </div>

      {hasOptions ? (
        <div className="mt-3 grid gap-2">
          {bet.options.map(option => {
            const selected = answer?.answer === option;
            const correct = resolved && isCorrectSideBetAnswer(option, bet.correct_answer);
            const wrongSelected = resolved && selected && !correct;
            return (
              <button
                key={option}
                type="button"
                disabled={locked || saving}
                onClick={() => onAnswer(bet, option)}
                className={`flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-default ${
                  correct ? "border-green-500 bg-green-500/15 text-green-200"
                  : wrongSelected ? "border-destructive bg-destructive/10 text-destructive"
                  : selected ? "border-accent bg-accent/15 text-foreground"
                  : "border-border/60 bg-secondary/40 text-muted-foreground hover:border-accent/70 hover:text-foreground"
                }`}
              >
                <span>{option}</span>
                {selected && <Check className="size-4" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            value={textAnswer}
            onChange={e => setTextAnswer(e.target.value)}
            disabled={locked || saving}
            placeholder="Skriv ditt svar"
            className={`min-w-0 flex-1 rounded-lg border px-3 py-2 outline-none focus:border-accent disabled:opacity-100 ${getTextAnswerStyle(bet, answer)}`}
          />
          {!locked && (
            <button
              type="button"
              disabled={saving || !textAnswer.trim()}
              onClick={() => onAnswer(bet, textAnswer)}
              className="flex h-10 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Save className="size-4" />
            </button>
          )}
        </div>
      )}

      {resolved && (
        <div className="mt-3 text-xs text-muted-foreground">
          Rätt svar:{" "}
          <span className="font-semibold text-foreground">
            {formatCorrectAnswers(bet.correct_answer)}
          </span>
          {answer ? <> · Du fick {answer.points}p</> : null}
        </div>
      )}
    </div>
  );
}

function getSideBetCardStyle(bet: SideBet, answer?: SideBetAnswer) {
  if (bet.correct_answer === null || !answer) return "border-border/60 bg-card/60";
  if (answer.points > 0) {
    return "border-green-500/45 bg-green-500/10 shadow-[inset_2px_0_0_rgba(34,197,94,0.85)]";
  }
  return "border-red-500/40 bg-red-500/10 shadow-[inset_2px_0_0_rgba(239,68,68,0.85)]";
}

function getTextAnswerStyle(bet: SideBet, answer?: SideBetAnswer) {
  if (bet.correct_answer === null || !answer) return "border-border bg-input disabled:opacity-70";
  if (answer.points > 0) return "border-green-500/45 bg-green-500/15 text-green-200";
  return "border-red-500/45 bg-red-500/15 text-red-200";
}

function isLocked(bet: SideBet) {
  return new Date() >= new Date(bet.deadline) || bet.correct_answer !== null;
}

function isCorrectSideBetAnswer(answer: string, correctAnswer: string | null) {
  if (!correctAnswer) return false;
  const normalizedAnswer = normalizeSideBetAnswer(answer);
  return getCorrectAnswerParts(correctAnswer).some(
    (part) => normalizeSideBetAnswer(part) === normalizedAnswer,
  );
}

function formatCorrectAnswers(correctAnswer: string | null) {
  return getCorrectAnswerParts(correctAnswer).join(", ") || "-";
}

function getCorrectAnswerParts(correctAnswer: string | null) {
  return (correctAnswer ?? "")
    .split(/[,;|\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeSideBetAnswer(answer: string) {
  return answer.trim().toLocaleLowerCase("sv-SE");
}

function formatDeadline(deadline: string) {
  return new Date(deadline).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}
