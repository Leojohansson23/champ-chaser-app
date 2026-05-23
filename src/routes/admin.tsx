import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TeamWithFlag } from "../lib/flags";
import { toast } from "sonner";
import { Plus, Trash2, Save, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
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

type SideBet = {
  id: string;
  question: string;
  options: string[];
  points: number;
  deadline: string;
  correct_answer: string | null;
};

type Participant = {
  id: string;
  username: string;
  is_paid: boolean;
};

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [sideBets, setSideBets] = useState<SideBet[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [entryFee, setEntryFee] = useState("100");
  const [draft, setDraft] = useState({
    group_name: "A", home_team: "", away_team: "", kickoff: "", city: "", stadium: "",
  });
  const [sideBetDraft, setSideBetDraft] = useState({
    question: "", points: "3", deadline: "",
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const db = supabase as any;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const load = async () => {
    const { data } = await supabase.from("matches").select("*").order("kickoff");
    setMatches((data ?? []) as Match[]);
  };

  const loadSideBets = async () => {
    const { data } = await db.from("side_bets").select("*").order("deadline");
    setSideBets((data ?? []) as SideBet[]);
  };

  const loadParticipants = async () => {
    const { data, error } = await db.from("profiles").select("id, username, is_paid").order("username");
    if (error) {
      toast.error(error.message);
      return;
    }
    setParticipants((data ?? []) as Participant[]);
  };

  const loadEntryFee = async () => {
    const { data, error } = await db.from("app_settings").select("value").eq("key", "entry_fee").maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    setEntryFee(String(Number(data?.value?.amount ?? 100)));
  };

  useEffect(() => {
    if (user && isAdmin) {
      load();
      loadSideBets();
      loadParticipants();
      loadEntryFee();
    }
  }, [user, isAdmin]);

  const grouped = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    matches.forEach(match => { (groups[match.group_name] ??= []).push(match); });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  useEffect(() => {
    if (grouped.length === 0) return;
    setOpenGroups(current => {
      if (Object.keys(current).length > 0) return current;
      return { [grouped[0][0]]: true };
    });
  }, [grouped]);

  if (!user || loading) return null;

  if (!isAdmin) {
    return (
      <div className="space-y-4 pt-6">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <h1 className="font-display text-2xl">Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Du har ingen admin-roll. Be en befintlig admin om åtkomst.
          </p>
        </div>
      </div>
    );
  }

  const addMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.home_team || !draft.away_team || !draft.kickoff) return;
    const { error } = await supabase.from("matches").insert({
      group_name: draft.group_name,
      home_team: draft.home_team,
      away_team: draft.away_team,
      kickoff: new Date(draft.kickoff).toISOString(),
      city: draft.city || null,
      stadium: draft.stadium || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Match tillagd");
      setDraft({ group_name: draft.group_name, home_team: "", away_team: "", kickoff: "", city: "", stadium: "" });
      load();
    }
  };

  const addSideBet = async (e: React.FormEvent) => {
    e.preventDefault();
    const points = parseInt(sideBetDraft.points);
    if (!sideBetDraft.question || !sideBetDraft.deadline || isNaN(points) || points < 1) {
      toast.error("Fyll i fråga, deadline och poäng");
      return;
    }

    const { error } = await db.from("side_bets").insert({
      question: sideBetDraft.question,
      options: [],
      points,
      deadline: new Date(sideBetDraft.deadline).toISOString(),
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Sidospel tillagt");
      setSideBetDraft({ question: "", points: "3", deadline: "" });
      loadSideBets();
    }
  };

  const saveEntryFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.max(0, Math.round(Number(entryFee)));
    if (!Number.isFinite(amount)) {
      toast.error("Ange en giltig summa");
      return;
    }

    const { error } = await db.from("app_settings").upsert({
      key: "entry_fee",
      value: { amount },
    });

    if (error) toast.error(error.message);
    else {
      setEntryFee(String(amount));
      toast.success("Inträdet uppdaterat");
    }
  };

  const togglePaid = async (participant: Participant) => {
    const { error } = await db
      .from("profiles")
      .update({ is_paid: !participant.is_paid })
      .eq("id", participant.id);

    if (error) toast.error(error.message);
    else {
      toast.success(participant.is_paid ? "Markerad som obetald" : "Markerad som betald");
      loadParticipants();
    }
  };

  const paidCount = participants.filter((participant) => participant.is_paid).length;
  const computedPrizePot = Math.max(0, Math.round(Number(entryFee) || 0)) * paidCount;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
        <h1 className="font-display text-3xl">Hantera matcher</h1>
      </div>

      <form onSubmit={saveEntryFee} className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Inträde per person"
            type="number"
            value={entryFee}
            onChange={setEntryFee}
            className="min-w-[180px] flex-1"
          />
          <div className="min-w-[180px] rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Automatisk prispott</div>
            <div className="font-display text-2xl text-accent">{computedPrizePot} kr</div>
            <div className="text-xs text-muted-foreground">{paidCount} betalda x {Math.max(0, Math.round(Number(entryFee) || 0))} kr</div>
          </div>
          <button className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-secondary px-4 text-sm font-semibold">
            <Save className="size-3.5" /> Spara
          </button>
        </div>
      </form>

      <section className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-accent">Deltagare</h2>
            <p className="text-sm text-muted-foreground">Markera vilka som faktiskt har betalat inträdet.</p>
          </div>
          <div className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
            {paidCount}/{participants.length} betalda
          </div>
        </div>
        <div className="space-y-2">
          {participants.map((participant) => (
            <div key={participant.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2">
              <div>
                <div className="font-semibold">{participant.username}</div>
                <div className="text-xs text-muted-foreground">
                  {participant.is_paid ? "Betald" : "Ej betald"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => togglePaid(participant)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${participant.is_paid ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground"}`}
              >
                {participant.is_paid ? "Markera som obetald" : "Markera som betald"}
              </button>
            </div>
          ))}
          {participants.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Inga deltagare ännu.
            </div>
          )}
        </div>
      </section>

      <form onSubmit={addMatch} className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="grid grid-cols-3 gap-2">
          <Input label="Grupp" value={draft.group_name} onChange={v => setDraft(d => ({...d, group_name: v.toUpperCase().slice(0,2)}))} />
          <Input label="Hemma" value={draft.home_team} onChange={v => setDraft(d => ({...d, home_team: v}))} className="col-span-2" />
        </div>
        <Input label="Borta" value={draft.away_team} onChange={v => setDraft(d => ({...d, away_team: v}))} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Stad" value={draft.city} onChange={v => setDraft(d => ({...d, city: v}))} />
          <Input label="Stadium" value={draft.stadium} onChange={v => setDraft(d => ({...d, stadium: v}))} />
        </div>
        <Input label="Avspark" type="datetime-local" value={draft.kickoff} onChange={v => setDraft(d => ({...d, kickoff: v}))} />
        <button className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground">
          <Plus className="size-4" /> Lägg till match
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="font-display text-xl text-accent">Matcher ({matches.length})</h2>
        {grouped.map(([group, groupMatches]) => (
          <section key={group} className="space-y-2">
            <button
              type="button"
              onClick={() => setOpenGroups(current => ({ ...current, [group]: !current[group] }))}
              className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-left transition hover:bg-card"
            >
              <span className="font-display text-lg text-accent">Grupp {group}</span>
              <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {groupMatches.length} matcher
                <ChevronDown className={`size-4 transition-transform ${openGroups[group] ? "rotate-180" : ""}`} />
              </span>
            </button>
            {openGroups[group] && (
              <div className="space-y-2">
                {groupMatches.map(m => <AdminMatchRow key={m.id} match={m} onChange={load} />)}
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl text-accent">Sidospel ({sideBets.length})</h2>
        <form onSubmit={addSideBet} className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4">
          <Input label="Fråga" value={sideBetDraft.question} onChange={v => setSideBetDraft(d => ({ ...d, question: v }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Poäng" type="number" value={sideBetDraft.points} onChange={v => setSideBetDraft(d => ({ ...d, points: v }))} />
            <Input label="Deadline" type="datetime-local" value={sideBetDraft.deadline} onChange={v => setSideBetDraft(d => ({ ...d, deadline: v }))} />
          </div>
          <button className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground">
            <Plus className="size-4" /> Lägg till sidospel
          </button>
        </form>

        <div className="space-y-2">
          {sideBets.map(sideBet => (
            <AdminSideBetRow key={sideBet.id} sideBet={sideBet} onChange={loadSideBets} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminMatchRow({ match, onChange }: { match: Match; onChange: () => void }) {
  const [h, setH] = useState(match.home_score?.toString() ?? "");
  const [a, setA] = useState(match.away_score?.toString() ?? "");
  const [city, setCity] = useState(match.city ?? "");
  const [stadium, setStadium] = useState(match.stadium ?? "");

  useEffect(() => {
    setH(match.home_score?.toString() ?? "");
    setA(match.away_score?.toString() ?? "");
    setCity(match.city ?? "");
    setStadium(match.stadium ?? "");
  }, [match]);

  const save = async () => {
    const hs = h === "" ? null : parseInt(h);
    const as = a === "" ? null : parseInt(a);
    const { error } = await supabase
      .from("matches")
      .update({
        home_score: hs,
        away_score: as,
        city: city.trim() || null,
        stadium: stadium.trim() || null,
      })
      .eq("id", match.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Match sparad");
      onChange();
    }
  };

  const del = async () => {
    if (!confirm("Ta bort matchen?")) return;
    const { error } = await supabase.from("matches").delete().eq("id", match.id);
    if (error) toast.error(error.message);
    else { toast.success("Borttagen"); onChange(); }
  };

  const kickoff = new Date(match.kickoff);
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>Grupp {match.group_name} · {kickoff.toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</span>
        <button onClick={del} className="text-destructive"><Trash2 className="size-4" /></button>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-right font-semibold">
          <TeamWithFlag team={match.home_team} align="right" />
        </div>
        <div className="flex items-center gap-1">
          <input value={h} onChange={e => setH(e.target.value)} type="number" min={0} max={20} placeholder="-" className="h-10 w-12 rounded-md border border-border bg-input text-center font-bold" />
          <span>–</span>
          <input value={a} onChange={e => setA(e.target.value)} type="number" min={0} max={20} placeholder="-" className="h-10 w-12 rounded-md border border-border bg-input text-center font-bold" />
        </div>
        <div className="font-semibold">
          <TeamWithFlag team={match.away_team} />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Input label="Stad" value={city} onChange={setCity} />
        <Input label="Stadium" value={stadium} onChange={setStadium} />
      </div>
      <button onClick={save} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-secondary py-1.5 text-sm">
        <Save className="size-3.5" /> Spara match
      </button>
    </div>
  );
}

function AdminSideBetRow({ sideBet, onChange }: { sideBet: SideBet; onChange: () => void }) {
  const [correct, setCorrect] = useState(sideBet.correct_answer ?? "");
  const db = supabase as any;

  useEffect(() => {
    setCorrect(sideBet.correct_answer ?? "");
  }, [sideBet.correct_answer]);

  const saveCorrect = async () => {
    const { error } = await db
      .from("side_bets")
      .update({ correct_answer: correct || null })
      .eq("id", sideBet.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Rätt svar sparat");
      onChange();
    }
  };

  const del = async () => {
    if (!confirm("Ta bort sidospel?")) return;
    const { error } = await db.from("side_bets").delete().eq("id", sideBet.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Sidospel borttaget");
      onChange();
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{sideBet.question}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            {sideBet.points}p · Stänger {new Date(sideBet.deadline).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
          </div>
        </div>
        <button onClick={del} className="text-destructive"><Trash2 className="size-4" /></button>
      </div>

      <div className="mt-3 grid gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Rätt svar</span>
          <input
            value={correct}
            onChange={e => setCorrect(e.target.value)}
            placeholder="Skriv rätt svar"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 outline-none focus:border-accent"
          />
        </label>
        <button onClick={saveCorrect} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-secondary py-1.5 text-sm">
          <Save className="size-3.5" /> Spara rätt svar
        </button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", className = "" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} required
        className="w-full rounded-lg border border-border bg-input px-3 py-2 outline-none focus:border-accent"
      />
    </label>
  );
}
