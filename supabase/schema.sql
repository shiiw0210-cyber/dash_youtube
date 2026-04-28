-- スケジュールテーブル (GAS / Google Sheets から移行)
-- Supabase の SQL Editor で実行してください。

create extension if not exists "pgcrypto";

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  shoot text not null default '',
  shoot_date text not null default '',
  delivery_date text not null default '',
  publish_date text not null default '',
  editor text not null default '',
  thumbnail text not null default '',
  title text not null default '',
  content text not null default '',
  material_url text not null default '',
  todo boolean not null default false,
  -- アプリ側で生成する ISO8601 文字列をそのまま保存 (競合検知用)
  updated_at text not null default ''
);

create index if not exists schedules_publish_date_idx on public.schedules (publish_date);
create index if not exists schedules_editor_idx on public.schedules (editor);

-- RLS は API 経由 (service_role キー) でしかアクセスしない前提で無効のままにする。
-- もし anon キーから直接アクセスする場合は適切な policy を別途設定すること。
alter table public.schedules disable row level security;
