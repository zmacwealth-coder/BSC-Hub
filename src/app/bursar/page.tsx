import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import BursarDashboardClient from './BursarDashboardClient';

export const metadata = {
  title: 'Bursar Dashboard',
  description: 'Manage institutional fee billing and payments tracking.',
};

export default async function BursarDashboardPage() {
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

  if (!role || role.name !== 'BURSAR') {
    redirect('/login?unauthorized=true');
  }

  // Load students, classes, fee categories, and recorded payments
  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, class_id, classes(name)')
    .order('full_name', { ascending: true });

  const { data: feeCategories } = await supabase
    .from('fee_categories')
    .select('*, classes(name)')
    .order('name', { ascending: true });

  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .order('name', { ascending: true });

  const { data: payments } = await supabase
    .from('payments')
    .select('*, students(full_name, class_id, classes(name)), users(full_name)')
    .order('payment_date', { ascending: false });

  return (
    <div className="bg-slate-50 min-h-screen">
      <BursarDashboardClient
        students={students || []}
        feeCategories={feeCategories || []}
        initialPayments={payments || []}
        classes={classes || []}
      />
    </div>
  );
}
