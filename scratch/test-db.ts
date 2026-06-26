import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and key are missing. Make sure they are loaded.');
  process.exit(1);
}

console.log(`Connecting to Supabase at: ${supabaseUrl}`);
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  const tables = ['roles', 'users', 'classes', 'sessions', 'terms', 'subjects', 'students', 'fee_categories', 'results'];
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        console.log(`❌ Table "${table}": Error -> ${error.message} (Code: ${error.code})`);
      } else {
        console.log(`✅ Table "${table}": Exists! Record count = ${count}`);
      }
    } catch (e: any) {
      console.log(`❌ Table "${table}": Exception -> ${e.message}`);
    }
  }

  // Check auth users
  try {
    const { data: usersList, error: usersErr } = await supabase.auth.admin.listUsers();
    if (usersErr) {
      console.log(`❌ Auth Users check: Error -> ${usersErr.message}`);
    } else {
      console.log(`✅ Auth Users count: ${usersList?.users?.length || 0}`);
      usersList?.users?.forEach(u => console.log(`   - ${u.email} (${u.id})`));
    }
  } catch (e: any) {
    console.log(`❌ Auth Users check: Exception -> ${e.message}`);
  }
}

checkDatabase();
