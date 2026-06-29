import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  // 1. Authorize current user is SUPER_ADMIN
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  // Get profile
  const { data: profile } = await supabase
    .from('users')
    .select('role_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
  }

  const { data: role } = await supabase
    .from('roles')
    .select('name')
    .eq('id', profile.role_id)
    .single();

  if (!role || role.name !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized: Requires SUPER_ADMIN role' }, { status: 403 });
  }

  // 2. Query all tables using admin client
  const adminSupabase = createAdminClient();
  const TABLES_TO_BACKUP = [
    'roles',
    'users',
    'classes',
    'sessions',
    'terms',
    'subjects',
    'students',
    'results',
    'fee_categories',
    'payments',
    'tokens',
    'token_usage_logs',
    'audit_logs',
    'google_sheet_sync_logs'
  ];

  try {
    const backupData: Record<string, any[]> = {};
    for (const table of TABLES_TO_BACKUP) {
      const { data, error } = await adminSupabase.from(table).select('*');
      if (error) {
        throw new Error(`Failed to back up table ${table}: ${error.message}`);
      }
      backupData[table] = data || [];
    }

    // Add auth users
    const { data: authUsersData, error: authErr } = await adminSupabase.auth.admin.listUsers();
    if (authErr) {
      console.error('Failed to list auth users:', authErr);
      backupData['_auth_users'] = [];
    } else {
      backupData['_auth_users'] = (authUsersData.users || []).map(u => ({
        id: u.id,
        email: u.email,
        user_metadata: u.user_metadata
      }));
    }

    // Create response with backup file
    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="bsc_hub_backup_${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  } catch (err: any) {
    console.error('Backup error:', err);
    return NextResponse.json({ error: err.message || 'Backup failed' }, { status: 500 });
  }
}
