import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Recall Agentic RAG" },
      { name: "description", content: "Sign in to your organization's Recall workspace." },
      { property: "og:title", content: "Sign in · Recall Agentic RAG" },
      { property: "og:description", content: "Sign in to your organization's Recall workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/assistant", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/assistant", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed.");
      setBusy(false);
      return;
    }
    if (result.redirected) return; // browser navigates away
    navigate({ to: "/assistant", replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">≡R</div>
          <div>
            <div className="text-sm font-semibold leading-none">Recall</div>
            <div className="font-mono text-[10px] text-muted-foreground">agentic rag · multi-tenant</div>
          </div>
        </div>

        {confirmSent ? (
          <div className="rounded-lg border border-border bg-card p-5">
            <h1 className="text-lg font-semibold">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Click it to activate your account, then sign in.
            </p>
            <Button variant="outline" className="mt-4 w-full" onClick={() => { setConfirmSent(false); setMode("signin"); }}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-5">
            <h1 className="text-lg font-semibold">{mode === "signin" ? "Sign in" : "Create your account"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin" ? "Access your organization's knowledge workspace." : "You'll create or join a workspace after signing in."}
            </p>

            <Button variant="outline" className="mt-4 w-full" onClick={signInWithGoogle} disabled={busy}>
              Continue with Google
            </Button>

            <div className="my-4 flex items-center gap-3 font-mono text-[10px] uppercase text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={submit} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
              />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Sign in" : "Sign up"}
              </Button>
            </form>

            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              {mode === "signin" ? "No account yet? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
