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

- Tenant documents, SQL tool and seeded analytics remain a client-side prototype; Assistant alone can use a user-configured external backend so other demo views are not misrepresented as live.
- Local backend requests run directly in browser event handlers, never through a hosted proxy; localhost must refer to the user's machine. Settings alone persist in local storage, loaded after hydration.
- The existing StoreProvider owns backend settings and status; preserve its hot-reload-stable context so consumers cannot lose their provider.
- Lovable Cloud schema: organizations, profiles, user_roles, documents, document_chunks (vector(1536)), queries, audit_logs; tenant isolation via security-definer is_org_member/has_role, storage bucket "documents" keyed by {org_id}/ path prefix.
