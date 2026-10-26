create index if not exists document_chunks_embedding_hnsw on public.document_chunks using hnsw (embedding vector_cosine_ops);

create or replace function public.match_document_chunks(p_org_id uuid, query_embedding vector(1536), match_count int default 8)
returns table (chunk_id uuid, document_id uuid, document_name text, page int, content text, similarity float)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.document_id, d.name, c.page, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.org_id = p_org_id
    and d.status = 'indexed'
    and public.is_org_member(auth.uid(), p_org_id)
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20))
$$;

revoke all on function public.match_document_chunks(uuid, vector, int) from public, anon;
grant execute on function public.match_document_chunks(uuid, vector, int) to authenticated;