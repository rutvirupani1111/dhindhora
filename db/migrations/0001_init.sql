-- Dhindhora v1 schema. Applied by scripts/migrate.mjs, which records each file in schema_migrations.
create table if not exists users (
  id            text primary key,
  kind          text not null check (kind in ('guest','member','system')),
  name          text,
  email         text unique,
  email_verified timestamptz,
  image         text,
  password_hash text,
  claimed_into  text references users(id),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz
);

-- Member sessions: the cookie holds a random token, the table holds only its sha256.
create table if not exists sessions (
  token_hash text primary key,
  user_id    text not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions (user_id);

-- Auth.js adapter tables, kept for the Google provider once OAuth credentials exist.
create table if not exists accounts (
  user_id text not null references users(id) on delete cascade,
  type text not null, provider text not null, provider_account_id text not null,
  refresh_token text, access_token text, expires_at int, token_type text, scope text, id_token text, session_state text,
  primary key (provider, provider_account_id)
);
create table if not exists verification_tokens (
  identifier text not null, token text not null, expires timestamptz not null,
  primary key (identifier, token)
);

create table if not exists projects (
  id               text primary key,
  owner_id         text not null references users(id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 80),
  doc              jsonb not null check (octet_length(doc::text) <= 65536),
  published_doc    jsonb check (published_doc is null or octet_length(published_doc::text) <= 65536),
  published_version int,
  schema_version   smallint not null default 1,
  renderer_version text not null,
  style            text not null check (style in ('truck','cinema','kirana','akhbaar','neon')),
  aspect           text not null check (aspect in ('9:16','1:1','16:9')),
  length_sec       smallint not null check (length_sec in (10,15,30,45,60)),
  visibility       text not null default 'private' check (visibility in ('private','unlisted','public')),
  status           text not null default 'draft' check (status in ('draft','exported')),
  remix_of         text references projects(id) on delete set null,
  remix_count      int not null default 0,
  featured         boolean not null default false,
  is_demo          boolean not null default false,
  hidden_at        timestamptz,
  version          int not null default 1,
  published_at     timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists projects_owner_idx on projects (owner_id, updated_at desc) where deleted_at is null;
create index if not exists projects_gallery_idx on projects (featured, remix_count desc, published_at desc)
  where visibility = 'public' and deleted_at is null and hidden_at is null;

create table if not exists project_revisions (
  project_id text not null references projects(id) on delete cascade,
  version    int  not null,
  doc        jsonb not null,
  created_at timestamptz not null default now(),
  primary key (project_id, version)
);

create table if not exists logos (
  hash       text primary key,
  owner_id   text not null references users(id) on delete cascade,
  webp       bytea not null check (octet_length(webp) <= 65536),
  width      smallint not null check (width between 1 and 512),
  height     smallint not null check (height between 1 and 512),
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id           bigserial primary key,
  project_id   text not null references projects(id) on delete cascade,
  reporter_key text not null,
  reason       text not null check (reason in ('impersonation','misleading','offensive','spam','other')),
  note         text check (char_length(note) <= 500),
  resolved_at  timestamptz,
  resolution   text check (resolution in ('kept','hidden','deleted')),
  created_at   timestamptz not null default now(),
  unique (project_id, reporter_key)
);

create table if not exists rate_buckets (
  key        text primary key,
  tokens     real not null,
  updated_at timestamptz not null default now()
);
