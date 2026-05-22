import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BookOpenText, Clock3, Medal, Target } from "lucide-react";

export const Route = createFileRoute("/rules")({
  component: RulesPage,
});

function RulesPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Regler</p>
        <h1 className="mt-1 font-display text-3xl">Så fungerar VM-tipset</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Kort och tydligt så att alla spelar efter samma regler.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <RuleCard
          icon={<Medal className="size-4" />}
          title="Poäng för matchtips"
          items={[
            "2 poäng för exakt resultat.",
            "1 poäng för rätt utfall (1/X/2) men inte exakt resultat.",
            "0 poäng om utfallet är fel.",
          ]}
        />
        <RuleCard
          icon={<Clock3 className="size-4" />}
          title="När tipsen låses"
          items={[
            "Matchtips låses vid första avspark i turneringen.",
            "Sidospel kan ha en egen deadline per fråga.",
            "När deadline passerat går svaret inte att ändra.",
          ]}
        />
        <RuleCard
          icon={<Target className="size-4" />}
          title="Topplista och grupper"
          items={[
            "Topplista och grupper visas efter att du fyllt i alla tips.",
            "Admin kan se allt oavsett om tipsen är klara.",
            "Poäng uppdateras när admin matar in slutresultat.",
          ]}
        />
        <RuleCard
          icon={<BookOpenText className="size-4" />}
          title="Bra att veta"
          items={[
            "Använd samma stavning i sidospel där textsvar används.",
            "Vid lika poäng avgör appens ordning i topplistan.",
            "Är du osäker? Fråga admin innan deadline.",
          ]}
        />
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <h2 className="font-display text-xl text-accent">Snabbväg</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/matches" className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
            Till matcher
          </Link>
          <Link to="/sidebets" className="rounded-lg border border-border/60 px-3 py-2 text-xs font-semibold hover:bg-secondary">
            Till sidospel
          </Link>
        </div>
      </section>
    </div>
  );
}

function RuleCard({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
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
