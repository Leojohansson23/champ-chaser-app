import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Eye,
  EyeOff,
  ListChecks,
  Megaphone,
  Plus,
  Save,
  Shield,
  Target,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TeamWithFlag } from "../lib/flags";

/* eslint-disable @typescript-eslint/no-explicit-any */

const db = supabase as any;
const OVERVIEW_LIMIT = 5;

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

type AdminAnnouncement = {
  id: string;
  title: string;
  body: string;
  tone: "info" | "fun" | "urgent";
  is_active: boolean;
  created_at: string;
};

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [sideBets, setSideBets] = useState<SideBet[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [entryFee, setEntryFee] = useState("100");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState({
    group_name: "A",
    home_team: "",
    away_team: "",
    kickoff: "",
    city: "",
    stadium: "",
  });
  const [sideBetDraft, setSideBetDraft] = useState({
    question: "",
    points: "3",
    deadline: "",
  });
  const [announcementDraft, setAnnouncementDraft] = useState({
    title: "",
    body: "",
    is_active: true,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  const loadMatches = useCallback(async () => {
    const { data, error } = await supabase.from("matches").select("*").order("kickoff");
    if (error) {
      toast.error(error.message);
      return;
    }
    setMatches((data ?? []) as Match[]);
  }, []);

  const loadSideBets = useCallback(async () => {
    const { data, error } = await db.from("side_bets").select("*").order("deadline");
    if (error) {
      toast.error(error.message);
      return;
    }
    setSideBets((data ?? []) as SideBet[]);
  }, []);

  const loadParticipants = useCallback(async () => {
    const { data, error } = await db
      .from("profiles")
      .select("id, username, is_paid")
      .order("username");
    if (error) {
      toast.error(error.message);
      return;
    }
    setParticipants((data ?? []) as Participant[]);
  }, []);

  const loadAnnouncements = useCallback(async () => {
    const { data, error } = await db
      .from("admin_announcements")
      .select("id, title, body, tone, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setAnnouncements((data ?? []) as AdminAnnouncement[]);
  }, []);

  const loadEntryFee = useCallback(async () => {
    const { data, error } = await db
      .from("app_settings")
      .select("value")
      .eq("key", "entry_fee")
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    setEntryFee(String(Number(data?.value?.amount ?? 100)));
  }, []);

  const loadAll = useCallback(() => {
    loadMatches();
    loadSideBets();
    loadParticipants();
    loadAnnouncements();
    loadEntryFee();
  }, [loadAnnouncements, loadEntryFee, loadMatches, loadParticipants, loadSideBets]);

  useEffect(() => {
    if (user && isAdmin) loadAll();
  }, [isAdmin, loadAll, user]);

  const grouped = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    matches.forEach((match) => {
      (groups[match.group_name] ??= []).push(match);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  useEffect(() => {
    if (grouped.length === 0) return;
    setOpenGroups((current) => {
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

  const addMatch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.home_team.trim() || !draft.away_team.trim() || !draft.kickoff) {
      toast.error("Fyll i lag och avspark");
      return;
    }

    const { error } = await supabase.from("matches").insert({
      group_name: draft.group_name.trim().toUpperCase() || "A",
      home_team: draft.home_team.trim(),
      away_team: draft.away_team.trim(),
      kickoff: new Date(draft.kickoff).toISOString(),
      city: draft.city.trim() || null,
      stadium: draft.stadium.trim() || null,
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Match tillagd");
      setDraft({
        group_name: draft.group_name,
        home_team: "",
        away_team: "",
        kickoff: "",
        city: "",
        stadium: "",
      });
      loadMatches();
    }
  };

  const addSideBet = async (event: React.FormEvent) => {
    event.preventDefault();
    const points = parseInt(sideBetDraft.points, 10);
    if (!sideBetDraft.question.trim() || !sideBetDraft.deadline || isNaN(points) || points < 1) {
      toast.error("Fyll i fråga, deadline och poäng");
      return;
    }

    const { error } = await db.from("side_bets").insert({
      question: sideBetDraft.question.trim(),
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

  const saveEntryFee = async (event: React.FormEvent) => {
    event.preventDefault();
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

  const addAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = announcementDraft.title.trim();
    const body = announcementDraft.body.trim();
    if (!title || !body) {
      toast.error("Fyll i rubrik och meddelande");
      return;
    }
    if (title.length > 80 || body.length > 600) {
      toast.error("Rubrik max 80 tecken och meddelande max 600 tecken");
      return;
    }

    const { error } = await db.from("admin_announcements").insert({
      author_id: user.id,
      title,
      body,
      tone: "info",
      is_active: announcementDraft.is_active,
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Meddelande publicerat");
      setAnnouncementDraft({ title: "", body: "", is_active: true });
      loadAnnouncements();
    }
  };

  const toggleAnnouncement = async (announcement: AdminAnnouncement) => {
    const { error } = await db
      .from("admin_announcements")
      .update({ is_active: !announcement.is_active, updated_at: new Date().toISOString() })
      .eq("id", announcement.id);

    if (error) toast.error(error.message);
    else {
      toast.success(announcement.is_active ? "Meddelandet dolt" : "Meddelandet syns igen");
      loadAnnouncements();
    }
  };

  const deleteAnnouncement = async (announcement: AdminAnnouncement) => {
    if (!confirm("Ta bort adminmeddelandet?")) return;
    const { error } = await db.from("admin_announcements").delete().eq("id", announcement.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Meddelande borttaget");
      loadAnnouncements();
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
  const finishedMatches = matches.filter(
    (match) => match.home_score !== null && match.away_score !== null,
  ).length;
  const matchesAwaitingResult = matches.filter(
    (match) => match.home_score === null || match.away_score === null,
  );
  const overviewMatches = matchesAwaitingResult.slice(0, OVERVIEW_LIMIT);
  const openSideBets = sideBets.filter((sideBet) => sideBet.correct_answer === null).length;
  const visibleAnnouncements = announcements.filter(isAnnouncementVisible).length;
  const fee = Math.max(0, Math.round(Number(entryFee) || 0));
  const computedPrizePot = fee * paidCount;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
        <h1 className="font-display text-3xl">Kontrollpanel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hantera resultat, sidospel, deltagare och prispott från ett ställe.
        </p>
      </div>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={<ListChecks className="size-4" />}
          label="Matcher"
          value={`${finishedMatches}/${matches.length}`}
          text="resultat klara"
        />
        <StatCard
          icon={<Target className="size-4" />}
          label="Sidospel"
          value={`${sideBets.length - openSideBets}/${sideBets.length}`}
          text="rättade"
        />
        <StatCard
          icon={<Users className="size-4" />}
          label="Deltagare"
          value={`${paidCount}/${participants.length}`}
          text="betalda"
        />
        <StatCard
          icon={<Trophy className="size-4" />}
          label="Prispott"
          value={`${computedPrizePot} kr`}
          text={`${paidCount} x ${fee} kr`}
        />
        <StatCard
          icon={<Megaphone className="size-4" />}
          label="Meddelanden"
          value={`${visibleAnnouncements}/${announcements.length}`}
          text="synliga i 24h"
        />
      </section>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max">
            <TabsTrigger value="overview" className="gap-1.5">
              <Shield className="size-4" /> Översikt
            </TabsTrigger>
            <TabsTrigger value="matches" className="gap-1.5">
              <ListChecks className="size-4" /> Matcher
            </TabsTrigger>
            <TabsTrigger value="sidebets" className="gap-1.5">
              <Target className="size-4" /> Sidospel
            </TabsTrigger>
            <TabsTrigger value="announcements" className="gap-1.5">
              <Megaphone className="size-4" /> Meddelanden
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5">
              <Banknote className="size-4" /> Betalning
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <section className="grid gap-3 md:grid-cols-2">
            <AdminPanel
              title="Nästa resultat att fylla i"
              icon={<CalendarClock className="size-4" />}
            >
              <div className="space-y-2">
                {overviewMatches.map((match) => (
                  <CompactMatch key={match.id} match={match} />
                ))}
                {matchesAwaitingResult.length === 0 && (
                  <EmptyState text="Alla matcher som finns upplagda är resultatförda." />
                )}
                {matchesAwaitingResult.length > OVERVIEW_LIMIT && (
                  <div className="rounded-xl border border-border/60 bg-background/20 px-3 py-2 text-xs text-muted-foreground">
                    Visar nästa {OVERVIEW_LIMIT}. {matchesAwaitingResult.length - OVERVIEW_LIMIT}{" "}
                    fler väntar under Matcher.
                  </div>
                )}
              </div>
            </AdminPanel>

            <AdminPanel title="Sidospel att rätta" icon={<Target className="size-4" />}>
              <div className="space-y-2">
                {sideBets
                  .filter((sideBet) => sideBet.correct_answer === null)
                  .slice(0, 5)
                  .map((sideBet) => (
                    <CompactSideBet key={sideBet.id} sideBet={sideBet} />
                  ))}
                {openSideBets === 0 && <EmptyState text="Alla sidospel är rättade." />}
              </div>
            </AdminPanel>

            <AdminPanel title="Synliga meddelanden" icon={<Megaphone className="size-4" />}>
              <div className="space-y-2">
                {announcements
                  .filter(isAnnouncementVisible)
                  .slice(0, 3)
                  .map((announcement) => (
                    <CompactAnnouncement key={announcement.id} announcement={announcement} />
                  ))}
                {visibleAnnouncements === 0 && (
                  <EmptyState text="Inga adminmeddelanden visas just nu." />
                )}
              </div>
            </AdminPanel>
          </section>
        </TabsContent>

        <TabsContent value="matches" className="space-y-4">
          <AdminPanel title="Lägg till match" icon={<Plus className="size-4" />}>
            <form onSubmit={addMatch} className="grid gap-2">
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="Grupp"
                  value={draft.group_name}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      group_name: value.toUpperCase().slice(0, 2),
                    }))
                  }
                />
                <Input
                  label="Hemma"
                  value={draft.home_team}
                  onChange={(value) => setDraft((current) => ({ ...current, home_team: value }))}
                  className="col-span-2"
                />
              </div>
              <Input
                label="Borta"
                value={draft.away_team}
                onChange={(value) => setDraft((current) => ({ ...current, away_team: value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Stad"
                  value={draft.city}
                  onChange={(value) => setDraft((current) => ({ ...current, city: value }))}
                  required={false}
                />
                <Input
                  label="Stadium"
                  value={draft.stadium}
                  onChange={(value) => setDraft((current) => ({ ...current, stadium: value }))}
                  required={false}
                />
              </div>
              <Input
                label="Avspark"
                type="datetime-local"
                value={draft.kickoff}
                onChange={(value) => setDraft((current) => ({ ...current, kickoff: value }))}
              />
              <button className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                <Plus className="size-4" /> Lägg till match
              </button>
            </form>
          </AdminPanel>

          <section className="space-y-2">
            <SectionTitle title={`Matcher (${matches.length})`} />
            {grouped.map(([group, groupMatches]) => (
              <section key={group} className="space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((current) => ({ ...current, [group]: !current[group] }))
                  }
                  className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-left transition hover:bg-card"
                >
                  <span className="font-display text-lg text-accent">Grupp {group}</span>
                  <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {groupMatches.length} matcher
                    <ChevronDown
                      className={`size-4 transition-transform ${openGroups[group] ? "rotate-180" : ""}`}
                    />
                  </span>
                </button>
                {openGroups[group] && (
                  <div className="space-y-2">
                    {groupMatches.map((match) => (
                      <AdminMatchRow key={match.id} match={match} onChange={loadMatches} />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </section>
        </TabsContent>

        <TabsContent value="sidebets" className="space-y-4">
          <AdminPanel title="Lägg till sidospel" icon={<Plus className="size-4" />}>
            <form onSubmit={addSideBet} className="grid gap-2">
              <Input
                label="Fråga"
                value={sideBetDraft.question}
                onChange={(value) =>
                  setSideBetDraft((current) => ({ ...current, question: value }))
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Poäng"
                  type="number"
                  value={sideBetDraft.points}
                  onChange={(value) =>
                    setSideBetDraft((current) => ({ ...current, points: value }))
                  }
                />
                <Input
                  label="Deadline"
                  type="datetime-local"
                  value={sideBetDraft.deadline}
                  onChange={(value) =>
                    setSideBetDraft((current) => ({ ...current, deadline: value }))
                  }
                />
              </div>
              <button className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                <Plus className="size-4" /> Lägg till sidospel
              </button>
            </form>
          </AdminPanel>

          <section className="space-y-2">
            <SectionTitle title={`Sidospel (${sideBets.length})`} />
            {sideBets.map((sideBet) => (
              <AdminSideBetRow key={sideBet.id} sideBet={sideBet} onChange={loadSideBets} />
            ))}
            {sideBets.length === 0 && <EmptyState text="Inga sidospel upplagda ännu." />}
          </section>
        </TabsContent>

        <TabsContent value="announcements" className="space-y-4">
          <AdminPanel title="Nytt meddelande" icon={<Plus className="size-4" />}>
            <form onSubmit={addAnnouncement} className="grid gap-3">
              <Input
                label="Rubrik"
                value={announcementDraft.title}
                onChange={(value) =>
                  setAnnouncementDraft((current) => ({ ...current, title: value }))
                }
                placeholder="Ex. Viktig info inför deadline"
              />
              <Textarea
                label="Meddelande"
                value={announcementDraft.body}
                onChange={(value) =>
                  setAnnouncementDraft((current) => ({ ...current, body: value }))
                }
                placeholder="Skriv det alla ska se på startsidan"
              />
              <div className="flex justify-end">
                <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background/30 px-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={announcementDraft.is_active}
                    onChange={(event) =>
                      setAnnouncementDraft((current) => ({
                        ...current,
                        is_active: event.target.checked,
                      }))
                    }
                    className="size-4 accent-primary"
                  />
                  Visa direkt
                </label>
              </div>
              <button className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                <Megaphone className="size-4" /> Publicera meddelande
              </button>
            </form>
          </AdminPanel>

          <section className="space-y-2">
            <SectionTitle title={`Meddelanden (${announcements.length})`} />
            {announcements.map((announcement) => (
              <AdminAnnouncementRow
                key={announcement.id}
                announcement={announcement}
                onToggle={() => toggleAnnouncement(announcement)}
                onDelete={() => deleteAnnouncement(announcement)}
              />
            ))}
            {announcements.length === 0 && <EmptyState text="Inga adminmeddelanden ännu." />}
          </section>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <AdminPanel title="Prispott" icon={<CircleDollarSign className="size-4" />}>
            <form onSubmit={saveEntryFee} className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                label="Inträde per person"
                type="number"
                value={entryFee}
                onChange={setEntryFee}
              />
              <button className="flex h-10 items-center justify-center gap-1.5 self-end rounded-lg bg-secondary px-4 text-sm font-semibold">
                <Save className="size-3.5" /> Spara
              </button>
            </form>
            <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Automatisk prispott
              </div>
              <div className="font-display text-2xl text-accent">{computedPrizePot} kr</div>
              <div className="text-xs text-muted-foreground">
                {paidCount} betalda x {fee} kr
              </div>
            </div>
          </AdminPanel>

          <AdminPanel title="Deltagare" icon={<Users className="size-4" />}>
            <div className="mb-3 flex justify-end">
              <div className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                {paidCount}/{participants.length} betalda
              </div>
            </div>
            <div className="space-y-2">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{participant.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {participant.is_paid ? "Betald" : "Ej betald"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePaid(participant)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${
                      participant.is_paid
                        ? "bg-secondary text-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {participant.is_paid ? "Obetald" : "Betald"}
                  </button>
                </div>
              ))}
              {participants.length === 0 && <EmptyState text="Inga deltagare ännu." />}
            </div>
          </AdminPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <div className="mt-1 font-display text-2xl leading-none text-accent">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{text}</div>
    </div>
  );
}

function AdminPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-accent">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="font-display text-xl text-accent">{title}</h2>;
}

function CompactMatch({ match }: { match: Match }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Grupp {match.group_name}</span>
        <span>{formatDateTime(match.kickoff)}</span>
      </div>
      <div className="mt-1 font-semibold">
        {match.home_team} - {match.away_team}
      </div>
    </div>
  );
}

function CompactSideBet({ sideBet }: { sideBet: SideBet }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2 text-sm">
      <div className="font-semibold">{sideBet.question}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {sideBet.points}p · stänger {formatDateTime(sideBet.deadline)}
      </div>
    </div>
  );
}

function CompactAnnouncement({ announcement }: { announcement: AdminAnnouncement }) {
  const visible = isAnnouncementVisible(announcement);

  return (
    <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate font-semibold">{announcement.title}</div>
        {!visible && (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Utgången
          </span>
        )}
      </div>
      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{announcement.body}</div>
    </div>
  );
}

function AdminMatchRow({ match, onChange }: { match: Match; onChange: () => void }) {
  const [homeScore, setHomeScore] = useState(match.home_score?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(match.away_score?.toString() ?? "");
  const [city, setCity] = useState(match.city ?? "");
  const [stadium, setStadium] = useState(match.stadium ?? "");

  useEffect(() => {
    setHomeScore(match.home_score?.toString() ?? "");
    setAwayScore(match.away_score?.toString() ?? "");
    setCity(match.city ?? "");
    setStadium(match.stadium ?? "");
  }, [match]);

  const save = async () => {
    const parsedHome = homeScore === "" ? null : parseInt(homeScore, 10);
    const parsedAway = awayScore === "" ? null : parseInt(awayScore, 10);
    if (
      (parsedHome !== null && !Number.isFinite(parsedHome)) ||
      (parsedAway !== null && !Number.isFinite(parsedAway))
    ) {
      toast.error("Resultatet måste vara siffror");
      return;
    }

    const { error } = await supabase
      .from("matches")
      .update({
        home_score: parsedHome,
        away_score: parsedAway,
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
    if (!confirm("Ta bort matchen? Alla tips på matchen tas också bort.")) return;
    const { error } = await supabase.from("matches").delete().eq("id", match.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Match borttagen");
      onChange();
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="truncate">
          Grupp {match.group_name} · {formatDateTime(match.kickoff)}
        </span>
        <button
          type="button"
          title="Ta bort match"
          onClick={del}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0 text-right font-semibold">
          <TeamWithFlag team={match.home_team} align="right" />
        </div>
        <div className="flex items-center gap-1">
          <ScoreInput value={homeScore} onChange={setHomeScore} />
          <span className="text-muted-foreground">-</span>
          <ScoreInput value={awayScore} onChange={setAwayScore} />
        </div>
        <div className="min-w-0 font-semibold">
          <TeamWithFlag team={match.away_team} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Input label="Stad" value={city} onChange={setCity} required={false} />
        <Input label="Stadium" value={stadium} onChange={setStadium} required={false} />
      </div>
      <button
        type="button"
        onClick={save}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-sm font-semibold"
      >
        <Save className="size-3.5" /> Spara match
      </button>
    </div>
  );
}

function AdminSideBetRow({ sideBet, onChange }: { sideBet: SideBet; onChange: () => void }) {
  const [correct, setCorrect] = useState(sideBet.correct_answer ?? "");

  useEffect(() => {
    setCorrect(sideBet.correct_answer ?? "");
  }, [sideBet.correct_answer]);

  const saveCorrect = async () => {
    const { error } = await db
      .from("side_bets")
      .update({ correct_answer: correct.trim() || null })
      .eq("id", sideBet.id);

    if (error) toast.error(error.message);
    else {
      toast.success("Rätt svar sparat");
      onChange();
    }
  };

  const del = async () => {
    if (!confirm("Ta bort sidospel? Alla svar på frågan tas också bort.")) return;
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
        <div className="min-w-0">
          <div className="font-semibold">{sideBet.question}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            {sideBet.points}p · stänger {formatDateTime(sideBet.deadline)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sideBet.correct_answer ? (
            <CheckCircle2 className="size-4 text-accent" />
          ) : (
            <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Öppen
            </span>
          )}
          <button
            type="button"
            title="Ta bort sidospel"
            onClick={del}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          label="Rätt svar"
          value={correct}
          onChange={setCorrect}
          placeholder="Skriv rätt svar"
          required={false}
        />
        <button
          type="button"
          onClick={saveCorrect}
          className="flex h-10 items-center justify-center gap-1.5 self-end rounded-lg bg-secondary px-4 text-sm font-semibold"
        >
          <Save className="size-3.5" /> Spara
        </button>
      </div>
    </div>
  );
}

function AdminAnnouncementRow({
  announcement,
  onToggle,
  onDelete,
}: {
  announcement: AdminAnnouncement;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const visible = isAnnouncementVisible(announcement);

  return (
    <article className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{announcement.title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                visible
                  ? "bg-accent/10 text-accent"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {visible ? "Syns" : announcement.is_active ? "Utgången" : "Dold"}
            </span>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            {formatDateTime(announcement.created_at)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            title={announcement.is_active ? "Dölj meddelande" : "Visa meddelande"}
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground"
          >
            {announcement.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button
            type="button"
            title="Ta bort meddelande"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
        {announcement.body}
      </p>
    </article>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  className = "",
  placeholder,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-border bg-input px-3 py-2 outline-none focus:border-accent"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        maxLength={600}
        rows={5}
        className="w-full resize-y rounded-lg border border-border bg-input px-3 py-2 outline-none focus:border-accent"
      />
      <span className="mt-1 block text-right text-[10px] text-muted-foreground">
        {value.length}/600
      </span>
    </label>
  );
}

function ScoreInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      type="number"
      min={0}
      max={30}
      placeholder="-"
      className="h-10 w-12 rounded-md border border-border bg-input text-center font-bold outline-none focus:border-accent"
    />
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function isAnnouncementVisible(announcement: AdminAnnouncement) {
  return announcement.is_active && new Date(announcement.created_at).getTime() >= getAnnouncementCutoffTime();
}

function getAnnouncementCutoffTime() {
  return Date.now() - 24 * 60 * 60 * 1000;
}
