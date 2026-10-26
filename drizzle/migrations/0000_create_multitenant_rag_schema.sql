create extension if not exists vector;

create type public.app_role as enum ('admin', 'knowledge_manager', 'member');
create type public.doc_status as enum ('pending', 'processing', 'indexed', 'failed');
create type public.query_route as enum ('doc_retrieval', 'sql_query', 'clarify');
create type public.verification_status as enum ('grounded', 'corrected', 'abstained');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, org_id)
);

create or replace function public.is_org_member(_user_id uuid, _org_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and org_id = _org_id
  )
$$;

create or replace function public.has_role(_user_id uuid, _org_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and org_id = _org_id and role = _role
  )
$$;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('PDF', 'TXT', 'MD')),
  size_kb integer not null default 0,
  status public.doc_status not null default 'pending',
  progress integer not null default 0 check (progress between 0 and 100),
  error text,
  storage_path text,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now()
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  page integer not null default 1,
  content text not null,
  token_count integer not null default 0,
  embedding vector(1536)
);

create table public.queries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid,
  question text not null,
  route public.query_route not null,
  latency_ms integer not null default 0,
  verification public.verification_status not null,
  retries integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  actor_id uuid,
  action text not null,
  target text not null,
  created_at timestamptz not null default now()
);

grant select on public.organizations to authenticated;
grant all on public.organizations to service_role;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
grant select, insert, update, delete on public.document_chunks to authenticated;
grant all on public.document_chunks to service_role;
grant select, insert on public.queries to authenticated;
grant all on public.queries to service_role;
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.queries enable row level security;
alter table public.audit_logs enable row level security;

create policy "Members can view their organization"
  on public.organizations for select to authenticated
  using (public.is_org_member(auth.uid(), id));

create policy "Users can view own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Members can view roles in their org"
  on public.user_roles for select to authenticated
  using (public.is_org_member(auth.uid(), org_id));

create policy "Members can view org documents"
  on public.documents for select to authenticated
  using (public.is_org_member(auth.uid(), org_id));
create policy "Managers can upload documents"
  on public.documents for insert to authenticated
  with check (
    public.has_role(auth.uid(), org_id, 'admin')
    or public.has_role(auth.uid(), org_id, 'knowledge_manager')
  );
create policy "Managers can update documents"
  on public.documents for update to authenticated
  using (
    public.has_role(auth.uid(), org_id, 'admin')
    or public.has_role(auth.uid(), org_id, 'knowledge_manager')
  );
create policy "Managers can delete documents"
  on public.documents for delete to authenticated
  using (
    public.has_role(auth.uid(), org_id, 'admin')
    or public.has_role(auth.uid(), org_id, 'knowledge_manager')
  );

create policy "Members can view org chunks"
  on public.document_chunks for select to authenticated
  using (public.is_org_member(auth.uid(), org_id));
create policy "Managers can insert chunks"
  on public.document_chunks for insert to authenticated
  with check (
    public.has_role(auth.uid(), org_id, 'admin')
    or public.has_role(auth.uid(), org_id, 'knowledge_manager')
  );
create policy "Managers can delete chunks"
  on public.document_chunks for delete to authenticated
  using (
    public.has_role(auth.uid(), org_id, 'admin')
    or public.has_role(auth.uid(), org_id, 'knowledge_manager')
  );

create policy "Members can view org queries"
  on public.queries for select to authenticated
  using (public.is_org_member(auth.uid(), org_id));
create policy "Members can log queries"
  on public.queries for insert to authenticated
  with check (public.is_org_member(auth.uid(), org_id) and user_id = auth.uid());

create policy "Admins can view org audit logs"
  on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(), org_id, 'admin'));
create policy "Members can write audit logs"
  on public.audit_logs for insert to authenticated
  with check (public.is_org_member(auth.uid(), org_id) and actor_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();