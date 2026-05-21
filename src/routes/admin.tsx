import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

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
};

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [draft, setDraft] = useState({
    group_name: "A", home_team: "", away_team: "", kickoff: "",
  });
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const load = async () => {
    const { data } = await supabase.from("matches").select("*").order("kickoff");
    setMatches((data ?? []) as Match[]);
  };

  useEffect(() => { if (user && isAdmin) load(); }, [user, isAdmin]);

  if (!user || loading) return null;

  if (!isAdmin) {
    return (
      <div className="space-y-4 pt-6">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <h1 className="font-display text-2xl">Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Du har ingen admin-roll. Den första användaren kan göra sig själv till admin här:
          </p>
          <button
            disabled={promoting}
            onClick={async () => {
              setPromoting(true);
              const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
              if ((count ?? 0) > 0) { toast.error("Det finns redan en admin. Be den befintliga admin om åtkomst."); setPromoting(false); return; }
              const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" });
              setPromoting(false);
              if (error) toast.error(error.message);
              else { toast.success("Du är nu admin – ladda om sidan."); setTimeout(() => location.reload(), 800); }
            }}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
          >
            Bli första admin
          </button>
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
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Match tillagd");
      setDraft({ group_name: draft.group_name, home_team: "", away_team: "", kickoff: "" });
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
        <h1 className="font-display text-3xl">Hantera matcher</h1>
      </div>

      <form onSubmit={addMatch} className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="grid grid-cols-3 gap-2">
          <Input label="Grupp" value={draft.group_name} onChange={v => setDraft(d => ({...d, group_name: v.toUpperCase().slice(0,2)}))} />
          <Input label="Hemma" value={draft.home_team} onChange={v => setDraft(d => ({...d, home_team: v}))} className="col-span-2" />
        </div>
        <Input label="Borta" value={draft.away_team} onChange={v => setDraft(d => ({...d, away_team: v}))} />
        <Input label="Avspark" type="datetime-local" value={draft.kickoff} onChange={v => setDraft(d => ({...d, kickoff: v}))} />
        <button className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground">
          <Plus className="size-4" /> Lägg till match
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="font-display text-xl text-accent">Matcher ({matches.length})</h2>
        {matches.map(m => <AdminMatchRow key={m.id} match={m} onChange={load} />)}
      </div>
    </div>
  );
}

function AdminMatchRow({ match, onChange }: { match: Match; onChange: () => void }) {
  const [h, setH] = useState(match.home_score?.toString() ?? "");
  const [a, setA] = useState(match.away_score?.toString() ?? "");

  const save = async () => {
    const hs = h === "" ? null : parseInt(h);
    const as = a === "" ? null : parseInt(a);
    const { error } = await supabase.from("matches").update({ home_score: hs, away_score: as }).eq("id", match.id);
    if (error) toast.error(error.message);
    else toast.success("Resultat sparat");
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
        <div className="text-right font-semibold">{match.home_team}</div>
        <div className="flex items-center gap-1">
          <input value={h} onChange={e => setH(e.target.value)} type="number" min={0} max={20} placeholder="-" className="h-10 w-12 rounded-md border border-border bg-input text-center font-bold" />
          <span>–</span>
          <input value={a} onChange={e => setA(e.target.value)} type="number" min={0} max={20} placeholder="-" className="h-10 w-12 rounded-md border border-border bg-input text-center font-bold" />
        </div>
        <div className="font-semibold">{match.away_team}</div>
      </div>
      <button onClick={save} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-secondary py-1.5 text-sm">
        <Save className="size-3.5" /> Spara resultat
      </button>
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
