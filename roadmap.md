# Backend connection
- [x] Add persisted settings, connection checks and endpoint contract.
- [x] Connect assistant with tenant-scoped sessions and recovery.
- [x] Verify request rules and live/recovery browser flows (24 tests; temporary local HTTP server; no browser runtime errors).

# Lovable Cloud
- [x] Enable Lovable Cloud.
- [x] Create multi-tenant schema (organizations, profiles, user_roles, documents, document_chunks, queries, audit_logs) with RLS.
- [x] Create private "documents" storage bucket (50MB) with tenant-scoped storage policies.
- [ ] Wire app views (documents, assistant, analytics, audit) to the Cloud backend; add sign-in.
