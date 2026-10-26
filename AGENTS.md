<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The app is a front-end prototype: all tenant data, the agent (src/lib/agent.ts) and the SQL engine (src/lib/sql.ts) are simulated client-side in src/lib/store.tsx — keeps the demo self-contained until a real backend is requested.
