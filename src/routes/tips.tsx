import { createFileRoute } from "@tanstack/react-router";
import { ListChecks, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequireCompletedEntry } from "@/lib/entry-completion";
import { MatchesPage } from "@/routes/matches";
import { SideBetsPage } from "@/routes/sidebets";

export const Route = createFileRoute("/tips")({
  component: () => (
    <RequireCompletedEntry>
      <TipsPage />
    </RequireCompletedEntry>
  ),
});

function TipsPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Tips</p>
        <h1 className="font-display text-3xl">Matcher & sidospel</h1>
      </div>

      <Tabs defaultValue="matches" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2">
          <TabsTrigger value="matches" className="gap-1.5">
            <ListChecks className="size-4" /> Matcher
          </TabsTrigger>
          <TabsTrigger value="sidebets" className="gap-1.5">
            <Target className="size-4" /> Sidospel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="mt-0">
          <MatchesPage />
        </TabsContent>
        <TabsContent value="sidebets" className="mt-0">
          <SideBetsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
