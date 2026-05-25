import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) navigate({ to: "/" }); }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            username: username || email.split("@")[0],
            registration_code: registrationCode.trim(),
          },
        },
      });
      if (error) {
        toast.error(error.message);
      } else if (data?.session) {
        toast.success("Konto skapat! Du är nu inloggad.");
      } else {
        toast.success("Konto skapat! Kontrollera din e-post om bekräftelse krävs.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-sm pt-8">
      <div className="mb-8 text-center">
        <Trophy className="mx-auto size-10 text-accent" />
        <h1 className="mt-3 font-display text-4xl">VM-TIPSET</h1>
        <p className="text-sm text-muted-foreground">{mode === "signup" ? "Skapa konto och börja tippa" : "Logga in och tippa VM"}</p>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        {mode === "signup" && (
          <>
            <Field label="Användarnamn">
              <input
                value={username} onChange={e => setUsername(e.target.value)}
                required minLength={2} maxLength={20}
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 outline-none focus:border-accent"
              />
            </Field>
            <Field label="Registreringskod">
              <input
                value={registrationCode}
                onChange={e => setRegistrationCode(e.target.value)}
                required
                minLength={4}
                maxLength={64}
                autoComplete="off"
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 outline-none focus:border-accent"
              />
            </Field>
          </>
        )}
        <Field label="E-post">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required autoComplete="email"
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 outline-none focus:border-accent"
          />
        </Field>
        <Field label="Lösenord">
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 outline-none focus:border-accent"
          />
        </Field>
        <button
          disabled={busy}
          className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Vänta…" : mode === "signup" ? "Skapa konto" : "Logga in"}
        </button>
      </form>

      <button
        onClick={() => setMode(m => m === "signup" ? "signin" : "signup")}
        className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        {mode === "signup" ? "Har du redan konto? Logga in" : "Inget konto? Registrera dig"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
