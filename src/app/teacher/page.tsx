import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import TeacherDashboardClient from './TeacherDashboardClient';

export const metadata = {
  title: 'Teacher Dashboard',
  description: 'Manage marks and synchronize Google Sheets marksheets.',
};

export default async function TeacherDashboardPage() {
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

  if (!role || role.name !== 'TEACHER') {
    redirect('/login?unauthorized=true');
  }

  // Load classes, subjects, sessions, terms, and sheet sync logs
  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .order('name', { ascending: true });

  const { data: subjects } = await supabase
    .from('subjects')
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

  // Load last 20 sheet sync logs
  const { data: syncLogs } = await supabase
    .from('google_sheet_sync_logs')
    .select('*, subjects(name), classes(name)')
    .order('sync_time', { ascending: false })
    .limit(20);

  // Load students directory
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .order('full_name', { ascending: true });

  // Load existing results with student details
  const { data: existingResults } = await supabase
    .from('results')
    .select('*, students(full_name, class_id), subjects(name)')
    .order('created_at', { ascending: false });

  return (
    <div className="bg-slate-50 min-h-screen">
      <TeacherDashboardClient
        classes={classes || []}
        subjects={subjects || []}
        sessions={sessions || []}
        terms={terms || []}
        initialSyncLogs={syncLogs || []}
        initialResults={existingResults || []}
        students={students || []}
      />
    </div>
  );
}
