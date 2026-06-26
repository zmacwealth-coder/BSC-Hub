import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import AdminDashboardClient from './AdminDashboardClient';

export const metadata = {
  title: 'Admin Dashboard',
  description: 'Manage institutional entities, staff roles, and tokens.',
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Verify Role in server component
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  const { data: role } = await supabase
    .from('roles')
    .select('name')
    .eq('id', profile.role_id)
    .single();

  if (!role || role.name !== 'SUPER_ADMIN') {
    redirect('/login?unauthorized=true');
  }

  // Load students, classes, sessions, terms, tokens, audit logs, fee categories, payments, and results
  const { data: students } = await supabase
    .from('students')
    .select('*, classes(name), sessions(name)')
    .order('created_at', { ascending: false });

  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .order('name', { ascending: true });

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .order('name', { ascending: false });

  const { data: terms } = await supabase
    .from('terms')
    .select('*')
    .order('name', { ascending: true });

  const { data: tokens } = await supabase
    .from('tokens')
    .select('*, students(full_name)')
    .order('created_at', { ascending: false });

  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*, users(full_name)')
    .order('timestamp', { ascending: false })
    .limit(50);

  const { data: feeCategories } = await supabase
    .from('fee_categories')
    .select('*');

  const { data: payments } = await supabase
    .from('payments')
    .select('*');

  const { data: results } = await supabase
    .from('results')
    .select('*, students(class_id), subjects(name)');

  return (
    <div className="bg-slate-50 min-h-screen">
      <AdminDashboardClient
        initialStudents={students || []}
        classes={classes || []}
        sessions={sessions || []}
        terms={terms || []}
        initialTokens={tokens || []}
        initialAuditLogs={auditLogs || []}
        feeCategories={feeCategories || []}
        payments={payments || []}
        results={results || []}
      />
    </div>
  );
}
