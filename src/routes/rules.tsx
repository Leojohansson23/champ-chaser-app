import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Banknote,
  BookOpenText,
  CalendarClock,
  CheckCircle2,
  ListChecks,
  Medal,
  MessageCircle,
  Shield,
  Table2,
  Target,
  Trophy,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/rules")({
  component: RulesPage,
});

function RulesPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Regler & info</p>
        <h1 className="mt-1 font-display text-3xl">Så fungerar VM-tipset</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Alla tippar samma matcher och sidospel. Poängen räknas globalt, och privata ligor visar
          egna topplistor för kompisar, familj eller jobb.
        </p>
      </section>

      <section className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
        <h2 className="flex items-center gap-2 font-display text-xl text-accent">
          <CheckCircle2 className="size-5" />
          Börja här
        </h2>
        <ol className="mt-3 space-y-2 text-sm text-foreground/90">
          <li>1. Gå till Tippa och fyll i alla matchtips.</li>
          <li>2. Fyll i alla sidospel som finns upplagda.</li>
          <li>3. När allt är ifyllt låses resten av appen upp.</li>
          <li>4. Följ poängen i Topplista eller skapa en privat liga under Ligor.</li>
        </ol>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <InfoCard
          icon={<Medal className="size-4" />}
          title="Poäng för matchtips"
          items={[
            "3 poäng för helt rätt resultat.",
            "1 poäng för rätt 1X2, alltså rätt vinnare eller oavgjort.",
            "0 poäng om utfallet är fel.",
            "Poängen uppdateras när admin lägger in slutresultat.",
          ]}
        />
        <InfoCard
          icon={<Target className="size-4" />}
          title="Sidospel"
          items={[
            "Sidospel är bonusfrågor vid sidan av matcherna.",
            "Varje sidospel kan ha egen poäng och egen deadline.",
            "Rätt sidospel räknas in i totalpoängen.",
            "När admin sätter rätt svar visas facit och poäng.",
          ]}
        />
        <InfoCard
          icon={<CalendarClock className="size-4" />}
          title="Deadlines"
          items={[
            "Matchtips låses 10 juni 2026 kl. 23:59 svensk tid.",
            "En match som redan fått resultat kan inte tippas om.",
            "Sidospel låses vid sin egen deadline.",
            "Efter deadline går svaret inte att ändra.",
          ]}
        />
        <InfoCard
          icon={<Trophy className="size-4" />}
          title="Topplistor"
          items={[
            "Den globala topplistan visar alla deltagare.",
            "Privata ligor visar bara medlemmarna i ligan.",
            "Går du med i en liga senare tar du med dina befintliga poäng.",
            "Privata ligor påverkar inte den globala tävlingen.",
          ]}
        />
        <InfoCard
          icon={<Users className="size-4" />}
          title="Privata ligor"
          items={[
            "Skapa en liga och dela ligakoden med de som ska vara med.",
            "Den som har koden kan gå med i ligan.",
            "Ägaren kan ta bort sin liga.",
            "Medlemmar kan lämna en liga utan att deras tips försvinner.",
          ]}
        />
        <InfoCard
          icon={<Banknote className="size-4" />}
          title="Prispott"
          items={[
            "Prispotten hör till huvudtävlingen.",
            "Den räknas på antal betalda deltagare gånger avgiften.",
            "Privata ligor har ingen egen prispott i appen.",
            "Admin markerar vilka deltagare som har betalat.",
          ]}
        />
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <h2 className="flex items-center gap-2 font-display text-xl text-accent">
          <BookOpenText className="size-5" />
          Hitta i appen
        </h2>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <NavHint
            icon={<ListChecks className="size-4" />}
            title="Tippa"
            text="Här fyller du i matchtips och sidospel innan allt är klart."
          />
          <NavHint
            icon={<ListChecks className="size-4" />}
            title="Matcher"
            text="Här ser du matcher, resultat och vad andra har tippat."
          />
          <NavHint
            icon={<Target className="size-4" />}
            title="Sidospel"
            text="Här ser du bonusfrågor, deadlines och rätt svar när de är klara."
          />
          <NavHint
            icon={<Trophy className="size-4" />}
            title="Topplista"
            text="Här visas den globala ställningen."
          />
          <NavHint
            icon={<Users className="size-4" />}
            title="Ligor"
            text="Här skapar du privata ligor eller går med via kod."
          />
          <NavHint
            icon={<Table2 className="size-4" />}
            title="Grupper"
            text="Här visas VM-gruppernas tabeller utifrån matchresultaten."
          />
          <NavHint
            icon={<MessageCircle className="size-4" />}
            title="Kommentarer"
            text="På Hem kan deltagare skriva korta kommentarer."
          />
          <NavHint
            icon={<Shield className="size-4" />}
            title="Admin"
            text="Admin hanterar matcher, resultat, sidospel och betalstatus."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <h2 className="font-display text-xl text-accent">Snabbvägar</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <QuickLink to="/entry">Tippa klart</QuickLink>
          <QuickLink to="/matches">Matcher</QuickLink>
          <QuickLink to="/sidebets">Sidospel</QuickLink>
          <QuickLink to="/leaderboard">Topplista</QuickLink>
          <QuickLink to="/leagues">Ligor</QuickLink>
        </div>
      </section>
    </div>
  );
}

function InfoCard({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return (
    <article className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <h2 className="flex items-center gap-2 font-display text-lg text-accent">
        {icon}
        {title}
      </h2>
      <ul className="mt-2 space-y-1.5 text-sm text-foreground/90">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function NavHint({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-3">
      <div className="flex items-center gap-2 font-semibold">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function QuickLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border/60 px-3 py-2 text-xs font-semibold hover:bg-secondary"
    >
      {children}
    </Link>
  );
}
