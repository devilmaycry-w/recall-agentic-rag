import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, FileText, ShieldCheck, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Recall — Agentic RAG Knowledge Assistant" },
      { name: "description", content: "Multi-tenant agentic RAG assistant with self-correction, citations and evaluation." },
      { property: "og:title", content: "Recall — Agentic RAG Knowledge Assistant" },
      { property: "og:description", content: "Multi-tenant agentic RAG assistant with self-correction, citations and evaluation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">≡R</div>
          <span className="text-sm font-semibold">Recall</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={signedIn ? "/assistant" : "/auth"}>{signedIn ? "Open app" : "Sign in"}</Link>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
        <div className="font-mono text-xs text-primary">// agentic rag · multi-tenant</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Your organization's knowledge, answered with evidence.</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Upload documents, ask questions, and get routed, cited, self-verified answers. Every workspace is fully
          isolated, every answer is grounded — or the assistant says so instead of guessing.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to={signedIn ? "/assistant" : "/auth"}>
              {signedIn ? "Open the assistant" : "Get started"} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-14 grid gap-3 sm:grid-cols-3">
          {[
            { icon: FileText, title: "Document ingestion", text: "PDF, TXT and Markdown parsed, chunked, embedded and indexed automatically." },
            { icon: Workflow, title: "Agentic routing", text: "Questions route to document retrieval, read-only SQL, or a clarification request." },
            { icon: ShieldCheck, title: "Tenant isolation", text: "Per-organization roles, storage and audit trails keep every workspace separate." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-4">
              <f.icon className="h-5 w-5 text-primary" />
              <div className="mt-2 text-sm font-medium">{f.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
