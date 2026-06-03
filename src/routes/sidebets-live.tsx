import { createFileRoute } from "@tanstack/react-router";
import { SideBetsLiveBoard } from "@/components/sidebets-live-board";
import { RequireCompletedEntry } from "@/lib/entry-completion";

export const Route = createFileRoute("/sidebets-live")({
  component: () => (
    <RequireCompletedEntry>
      <SideBetsLiveBoard />
    </RequireCompletedEntry>
  ),
});
