import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useEntryCompletion } from "@/lib/entry-completion";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, ListChecks, BarChart3, Shield, LogOut, Table2, Target, Home, BookOpenText } from "lucide-react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Sidan finns inte.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Till start
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Något gick fel</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Försök igen
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "VM-tipset" },
      { name: "description", content: "Tippa gruppspelet och toppa ligan." },
      { name: "theme-color", content: "#0f1a26" },
      { property: "og:title", content: "VM-tipset" },
      { name: "twitter:title", content: "VM-tipset" },
      { property: "og:description", content: "Tippa gruppspelet och toppa ligan." },
      { name: "twitter:description", content: "Tippa gruppspelet och toppa ligan." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ab002e68-e8e8-4318-8f6a-56d03448a331/id-preview-b11794e2--68732178-cb3f-49b5-8dd8-bbb713e94501.lovable.app-1779372264231.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ab002e68-e8e8-4318-8f6a-56d03448a331/id-preview-b11794e2--68732178-cb3f-49b5-8dd8-bbb713e94501.lovable.app-1779372264231.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const queryClient = new QueryClient();

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="min-h-screen pb-24">
          <Header />
          <main className="mx-auto w-full max-w-2xl px-4 pt-4">
            <Outlet />
          </main>
          <BottomNav />
        </div>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function Header() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Trophy className="size-6 text-accent" />
          <span className="font-display text-2xl tracking-wider">VM-TIPSET</span>
        </Link>
        {user ? (
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
          >
            <LogOut className="size-3.5" /> Logga ut
          </button>
        ) : (
          <Link to="/auth" className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">
            Logga in
          </Link>
        )}
      </div>
    </header>
  );
}

function BottomNav() {
  const { user, isAdmin } = useAuth();
  const completion = useEntryCompletion();
  if (!user) return null;
  const item = "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors";
  const active = { className: "text-accent" };
  const canSeeLiveTabs = isAdmin || completion.isComplete;
  if (!canSeeLiveTabs) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-2xl">
          <Link to="/entry" className={item} activeProps={active}>
            <ListChecks className="size-5" /> Tippa
          </Link>
          <Link to="/rules" className={item} activeProps={active}>
            <BookOpenText className="size-5" /> Regler
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-2xl">
        <Link to="/" className={item} activeOptions={{ exact: true }} activeProps={active}>
          <Home className="size-5" /> Hem
        </Link>
        <Link to="/matches" className={item} activeProps={active}>
          <ListChecks className="size-5" /> Matcher
        </Link>
        <Link to="/sidebets" className={item} activeProps={active}>
          <Target className="size-5" /> Sidospel
        </Link>
        <Link to="/rules" className={item} activeProps={active}>
          <BookOpenText className="size-5" /> Regler
        </Link>
        {canSeeLiveTabs && (
          <>
            <Link to="/leaderboard" className={item} activeProps={active}>
              <BarChart3 className="size-5" /> Topplista
            </Link>
            <Link to="/groups" className={item} activeProps={active}>
              <Table2 className="size-5" /> Grupper
            </Link>
          </>
        )}
        {isAdmin && (
          <Link to="/admin" className={item} activeProps={active}>
            <Shield className="size-5" /> Admin
          </Link>
        )}
      </div>
    </nav>
  );
}
