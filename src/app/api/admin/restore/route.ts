import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  // 1. Authorize current user is SUPER_ADMIN
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  // Get profile
  const { data: profile } = await supabase
    .from('users')
    .select('role_id, id')
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

  const adminSupabase = createAdminClient();

  try {
    const backupData = await request.json();

    // Verify backup keys
    const REQUIRED_TABLES = [
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

    for (const table of REQUIRED_TABLES) {
      if (!Array.isArray(backupData[table])) {
        return NextResponse.json({ error: `Invalid backup file: missing or invalid table data for '${table}'` }, { status: 400 });
      }
    }

    // 2. Handle auth users mapping
    const authUsersMapping: Record<string, string> = {}; // maps old auth_user_id -> new auth_user_id
    const backedUpAuthUsers = backupData['_auth_users'] || [];

    if (backedUpAuthUsers.length > 0) {
      // List existing auth users
      const { data: existingAuthUsersData, error: listErr } = await adminSupabase.auth.admin.listUsers();
      if (listErr) throw new Error(`Failed to list existing auth users: ${listErr.message}`);
      const existingAuthUsers = existingAuthUsersData.users || [];

      for (const backupUser of backedUpAuthUsers) {
        if (!backupUser.email) continue;
        
        const match = existingAuthUsers.find(u => u.email === backupUser.email);
        if (match) {
          authUsersMapping[backupUser.id] = match.id;
        } else {
          // Create new auth user with email and metadata
          const { data: createData, error: createError } = await adminSupabase.auth.admin.createUser({
            email: backupUser.email,
            password: 'Password123!',
            email_confirm: true,
            user_metadata: backupUser.user_metadata || {}
          });
          if (createError) throw new Error(`Failed to recreate auth user ${backupUser.email}: ${createError.message}`);
          authUsersMapping[backupUser.id] = createData.user.id;
        }
      }
    }

    // 3. Truncate/Delete all existing rows in reverse dependency order
    const TABLES_TO_DELETE_ORDER = [
      'google_sheet_sync_logs',
      'audit_logs',
      'token_usage_logs',
      'tokens',
      'payments',
      'fee_categories',
      'results',
      'students',
      'subjects',
      'terms',
      'sessions',
      'classes',
      'users',
      'roles'
    ];

    for (const table of TABLES_TO_DELETE_ORDER) {
      const { error } = await adminSupabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        throw new Error(`Failed to clear table ${table}: ${error.message}`);
      }
    }

    // 4. Restore tables in forward dependency order
    const TABLES_TO_RESTORE_ORDER = [
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

    for (const table of TABLES_TO_RESTORE_ORDER) {
      const rows = backupData[table] || [];
      if (rows.length === 0) continue;

      // Prepare rows (map auth_user_id for users table)
      let preparedRows = rows;
      if (table === 'users') {
        preparedRows = rows.map((r: any) => {
          const mappedId = authUsersMapping[r.auth_user_id];
          return {
            ...r,
            auth_user_id: mappedId || r.auth_user_id // fallback if not mapped
          };
        });
      }

      // Insert in chunks of 100 to avoid any database limits/timeouts
      const CHUNK_SIZE = 100;
      for (let i = 0; i < preparedRows.length; i += CHUNK_SIZE) {
        const chunk = preparedRows.slice(i, i + CHUNK_SIZE);
        const { error } = await adminSupabase.from(table).insert(chunk);
        if (error) {
          throw new Error(`Failed to insert into ${table}: ${error.message}`);
        }
      }
    }

    // Create log in audit trail for the restore operation
    // Get updated profile of the restoring user in case IDs changed
    const { data: newProfile } = await adminSupabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    await adminSupabase.from('audit_logs').insert({
      action: 'RESTORE_BACKUP',
      user_id: newProfile?.id || null,
      details: `Restored entire database from backup. Recreated auth mapping for ${Object.keys(authUsersMapping).length} users.`,
      ip_address: '127.0.0.1',
      user_agent: 'Server Action'
    });

    return NextResponse.json({ success: true, message: 'Database restored successfully' });
  } catch (err: any) {
    console.error('Restore error:', err);
    return NextResponse.json({ error: err.message || 'Restore failed' }, { status: 500 });
  }
}
