-- ============================================================
-- Migration: initial_schema
-- Institution: Bright Success College
-- Description: Full schema for Multi-Role School Management & Results Hub
-- ============================================================

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. Roles table
-- ============================================================
create table roles (
    id uuid primary key default gen_random_uuid(),
    name text unique not null, -- e.g., 'SUPER_ADMIN', 'TEACHER', 'BURSAR'
    permissions jsonb not null default '[]'::jsonb
);

-- ============================================================
-- 2. Users table (Links to Supabase Auth.users via auth_user_id)
-- ============================================================
create table users (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid unique references auth.users(id) on delete cascade,
    username text unique not null,
    full_name text not null,
    role_id uuid not null references roles(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 3. Classes table
-- ============================================================
create table classes (
    id uuid primary key default gen_random_uuid(),
    name text unique not null, -- e.g., 'JSS1', 'SS3'
    level text not null check (level in ('JUNIOR', 'SENIOR'))
);

-- ============================================================
-- 4. Scholastic Sessions (Academic Year)
-- ============================================================
create table sessions (
    id uuid primary key default gen_random_uuid(),
    name text unique not null, -- e.g., '2025/2026'
    is_active boolean default false not null
);

-- ============================================================
-- 5. Scholastic Terms
-- ============================================================
create table terms (
    id uuid primary key default gen_random_uuid(),
    name text unique not null, -- e.g., 'First Term', 'Second Term'
    is_active boolean default false not null,
    next_term_begins text
);

-- ============================================================
-- 6. Academic Subjects
-- ============================================================
create table subjects (
    id uuid primary key default gen_random_uuid(),
    name text unique not null,
    description text
);

-- ============================================================
-- 7. Students Profile Directory
-- ============================================================
create table students (
    id text primary key, -- Custom Institution ID, e.g., 'BSC-2026-0001'
    admission_number text unique not null,
    full_name text not null,
    gender text not null check (gender in ('Male', 'Female')),
    date_of_birth date not null,
    address text not null,
    parent_name text not null,
    parent_phone text not null,
    parent_email text not null,
    class_id uuid not null references classes(id) on delete restrict,
    session_id uuid not null references sessions(id) on delete restrict,
    passport_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 8. Student Term Academic Results
-- ============================================================
create table results (
    id uuid primary key default gen_random_uuid(),
    student_id text not null references students(id) on delete cascade,
    subject_id uuid not null references subjects(id) on delete cascade,
    term_id uuid not null references terms(id) on delete cascade,
    session_id uuid not null references sessions(id) on delete cascade,
    ca_score double precision not null check (ca_score >= 0.0 and ca_score <= 30.0),
    exam_score double precision not null check (exam_score >= 0.0 and exam_score <= 70.0),
    total_score double precision not null check (total_score >= 0.0 and total_score <= 100.0),
    grade text not null,
    remark text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(student_id, subject_id, term_id, session_id)
);

-- ============================================================
-- 9. Billing Fee Categories (Configured per class)
-- ============================================================
create table fee_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null, -- e.g., 'Tuition Lecture Fee', 'ICT'
    default_amount double precision not null check (default_amount >= 0.0),
    class_id uuid not null references classes(id) on delete cascade,
    unique(name, class_id)
);

-- ============================================================
-- 10. Financial Log Payments
-- ============================================================
create table payments (
    id uuid primary key default gen_random_uuid(),
    student_id text not null references students(id) on delete cascade,
    amount_paid double precision not null check (amount_paid >= 0.0),
    total_expected double precision not null check (total_expected >= 0.0),
    balance double precision not null check (balance >= 0.0),
    category text not null,
    receipt_number text unique not null,
    payment_date timestamp with time zone default timezone('utc'::text, now()) not null,
    recorded_by uuid not null references users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 11. Security Parent Result-Checking Tokens
-- ============================================================
create table tokens (
    id uuid primary key default gen_random_uuid(),
    token_string text unique not null, -- e.g., 'ABC123XYZ'
    student_id text not null references students(id) on delete cascade,
    max_usage integer not null default 3,
    usage_count integer not null default 0,
    status text not null default 'Active' check (status in ('Active', 'Expired', 'Disabled', 'Consumed')),
    generated_by uuid not null references users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    expires_at timestamp with time zone not null
);

-- ============================================================
-- 12. Security Token Access Logs
-- ============================================================
create table token_usage_logs (
    id uuid primary key default gen_random_uuid(),
    token_id uuid not null references tokens(id) on delete cascade,
    visitor_name text not null,
    access_time timestamp with time zone default timezone('utc'::text, now()) not null,
    ip_address text not null,
    user_agent text not null
);

-- ============================================================
-- 13. System Audit Trail Logs
-- ============================================================
create table audit_logs (
    id uuid primary key default gen_random_uuid(),
    action text not null,
    user_id uuid references users(id) on delete set null,
    details text not null,
    ip_address text not null,
    user_agent text not null,
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 14. Google Sheet Sync Logs
-- ============================================================
create table google_sheet_sync_logs (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references users(id),
    subject_id uuid not null references subjects(id),
    class_id uuid not null references classes(id),
    status text not null check (status in ('Success', 'Failed')),
    sync_time timestamp with time zone default timezone('utc'::text, now()) not null,
    records_synced integer not null default 0,
    error_message text
);

-- ============================================================
-- Database Optimization Indexes
-- ============================================================
create index idx_students_class on students(class_id);
create index idx_students_session on students(session_id);
create index idx_results_lookup on results(student_id, subject_id, term_id, session_id);
create index idx_payments_student on payments(student_id);
create index idx_tokens_string on tokens(token_string);
create index idx_tokens_student on tokens(student_id);
create index idx_audit_timestamp on audit_logs(timestamp desc);
create index idx_sync_logs_teacher on google_sheet_sync_logs(teacher_id);

-- ============================================================
-- Automatic Timestamp Update Triggers
-- ============================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger set_users_updated_at
before update on users
for each row execute procedure update_updated_at_column();

create trigger set_students_updated_at
before update on students
for each row execute procedure update_updated_at_column();

create trigger set_results_updated_at
before update on results
for each row execute procedure update_updated_at_column();

-- ============================================================
-- Row Level Security (RLS) & Security Policies
-- ============================================================
alter table roles enable row level security;
alter table users enable row level security;
alter table classes enable row level security;
alter table sessions enable row level security;
alter table terms enable row level security;
alter table subjects enable row level security;
alter table students enable row level security;
alter table results enable row level security;
alter table fee_categories enable row level security;
alter table payments enable row level security;
alter table tokens enable row level security;
alter table token_usage_logs enable row level security;
alter table audit_logs enable row level security;
alter table google_sheet_sync_logs enable row level security;

-- Policies: authenticated users get full access.
-- Service-role operations (seeding, admin actions) bypass RLS natively.
create policy auth_all_roles on roles for all to authenticated using (true);
create policy auth_all_users on users for all to authenticated using (true);
create policy auth_all_classes on classes for all to authenticated using (true);
create policy auth_all_sessions on sessions for all to authenticated using (true);
create policy auth_all_terms on terms for all to authenticated using (true);
create policy auth_all_subjects on subjects for all to authenticated using (true);
create policy auth_all_students on students for all to authenticated using (true);
create policy auth_all_results on results for all to authenticated using (true);
create policy auth_all_fee_categories on fee_categories for all to authenticated using (true);
create policy auth_all_payments on payments for all to authenticated using (true);
create policy auth_all_tokens on tokens for all to authenticated using (true);
create policy auth_all_token_usage_logs on token_usage_logs for all to authenticated using (true);
create policy auth_all_audit_logs on audit_logs for all to authenticated using (true);
create policy auth_all_sync_logs on google_sheet_sync_logs for all to authenticated using (true);
