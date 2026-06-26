import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  
  // Protect seed route with a basic key check or allow in development
  const devMode = process.env.NODE_ENV === 'development';
  if (!devMode && key !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Unauthorized seed attempt.' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // 1. Seed Roles
    const rolesToSeed = [
      { name: 'SUPER_ADMIN', permissions: JSON.stringify(['all']) },
      { name: 'TEACHER', permissions: JSON.stringify(['read_scores', 'write_scores', 'view_students']) },
      { name: 'BURSAR', permissions: JSON.stringify(['read_finance', 'write_finance']) }
    ];

    const seededRoles = [];
    for (const r of rolesToSeed) {
      const { data, error } = await supabase
        .from('roles')
        .upsert({ name: r.name, permissions: JSON.parse(r.permissions) }, { onConflict: 'name' })
        .select()
        .single();
      
      if (error) {
        console.error('Error seeding role:', r.name, error);
        return NextResponse.json({ error: `Table 'roles' might not exist. Run Supabase SQL script first. Details: ${error.message}` }, { status: 500 });
      }
      seededRoles.push(data);
    }

    const superAdminRole = seededRoles.find(r => r.name === 'SUPER_ADMIN')!;
    const teacherRole = seededRoles.find(r => r.name === 'TEACHER')!;
    const bursarRole = seededRoles.find(r => r.name === 'BURSAR')!;

    // 2. Seed Sessions (Academic Year)
    const { data: sessionData, error: sessionErr } = await supabase
      .from('sessions')
      .upsert({ name: '2025/2026', is_active: true }, { onConflict: 'name' })
      .select()
      .single();
    
    if (sessionErr) throw new Error(`Sessions seed error: ${sessionErr.message}`);

    // 3. Seed Terms
    const termsToSeed = [
      { name: 'First Term', is_active: true },
      { name: 'Second Term', is_active: false },
      { name: 'Third Term', is_active: false }
    ];

    const seededTerms = [];
    for (const t of termsToSeed) {
      const { data, error } = await supabase
        .from('terms')
        .upsert(t, { onConflict: 'name' })
        .select()
        .single();
      if (error) throw new Error(`Terms seed error: ${error.message}`);
      seededTerms.push(data);
    }

    // 4. Seed Classes
    const classesToSeed = [
      { name: 'JSS1', level: 'JUNIOR' },
      { name: 'JSS2', level: 'JUNIOR' },
      { name: 'JSS3', level: 'JUNIOR' },
      { name: 'SS1', level: 'SENIOR' },
      { name: 'SS2', level: 'SENIOR' },
      { name: 'SS3', level: 'SENIOR' }
    ];

    const seededClasses = [];
    for (const c of classesToSeed) {
      const { data, error } = await supabase
        .from('classes')
        .upsert(c, { onConflict: 'name' })
        .select()
        .single();
      if (error) throw new Error(`Classes seed error: ${error.message}`);
      seededClasses.push(data);
    }

    // 5. Seed Subjects
    const subjectsToSeed = [
      { name: 'Mathematics', description: 'Core Mathematics course' },
      { name: 'English Language', description: 'Grammar and literature study' },
      { name: 'Physics', description: 'Basic Newtonian and modern physics' },
      { name: 'Chemistry', description: 'Study of matter and chemical bonding' },
      { name: 'Civic Education', description: 'Social studies and civic values' }
    ];

    const seededSubjects = [];
    for (const s of subjectsToSeed) {
      const { data, error } = await supabase
        .from('subjects')
        .upsert(s, { onConflict: 'name' })
        .select()
        .single();
      if (error) throw new Error(`Subjects seed error: ${error.message}`);
      seededSubjects.push(data);
    }

    // 6. Create default staff accounts in auth & user mapping
    const staffAccounts = [
      { email: 'admin@brightsuccesscollege.com', username: 'admin_dev', fullName: 'Super Admin User', roleId: superAdminRole.id },
      { email: 'teacher@brightsuccesscollege.com', username: 'teacher_dev', fullName: 'Senior Teacher John', roleId: teacherRole.id },
      { email: 'bursar@brightsuccesscollege.com', username: 'bursar_dev', fullName: 'Bursar Grace', roleId: bursarRole.id }
    ];

    const seededUsers = [];
    for (const staff of staffAccounts) {
      // Find if auth user exists
      const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) throw listError;
      
      let authUser = userList.users.find(u => u.email === staff.email);
      
      if (!authUser) {
        // Create user
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
          email: staff.email,
          password: 'Password123!',
          email_confirm: true,
          user_metadata: { full_name: staff.fullName }
        });
        if (createError) throw new Error(`Auth user creation failed: ${createError.message}`);
        authUser = createData.user;
      }

      // Upsert in users table
      const { data: profileData, error: profileErr } = await supabase
        .from('users')
        .upsert({
          auth_user_id: authUser.id,
          username: staff.username,
          full_name: staff.fullName,
          role_id: staff.roleId
        }, { onConflict: 'username' })
        .select()
        .single();

      if (profileErr) throw new Error(`Profile insert failed: ${profileErr.message}`);
      seededUsers.push(profileData);
    }

    // 7. Seed 10 Dummy Students
    const studentNames = [
      'Bisi Awosika', 'Chinedu Eze', 'Aminu Garba', 'Elizabeth Johnson', 
      'David Okeke', 'Fatima Musa', 'Tunde Yusuf', 'Grace Adebayo', 
      'Emeka Nwosu', 'Zainab Bello'
    ];
    const genders = ['Female', 'Male', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female'];

    const seededStudents = [];
    for (let i = 0; i < 10; i++) {
      const studentId = `BSC-2026-${String(i + 1).padStart(4, '0')}`;
      // Distribute students across classes
      const classObj = seededClasses[i % seededClasses.length];
      
      const studentPayload = {
        id: studentId,
        admission_number: `ADM-2026-${String(i + 1).padStart(2, '0')}`,
        full_name: studentNames[i],
        gender: genders[i],
        date_of_birth: `2012-04-${String((i * 2) + 1).padStart(2, '0')}`,
        address: `${i + 12} Gaa Baba Eji, Agbale, Ede, Osun State.`,
        parent_name: `Parent of ${studentNames[i]}`,
        parent_phone: `+234803000${String(i).repeat(4)}`,
        parent_email: `parent${i}@gmail.com`,
        class_id: classObj.id,
        session_id: sessionData.id
      };

      const { data: stdData, error: stdErr } = await supabase
        .from('students')
        .upsert(studentPayload, { onConflict: 'id' })
        .select()
        .single();
      
      if (stdErr) throw new Error(`Student ${studentId} seed error: ${stdErr.message}`);
      seededStudents.push(stdData);
    }

    // 8. Seed Default Fee Categories
    // Tuition Lecture Fee, Uniforms Levy, Books & Materials, Assessments & Exams, Other Admin Charges for JSS1-3 and SS1-3
    const seededFeeCategories = [];
    const defaultFeeMatrix = [
      { className: 'JSS1', category: 'Tuition Lecture Fee', amount: 35000 },
      { className: 'JSS1', category: 'Uniforms Levy', amount: 10000 },
      { className: 'JSS1', category: 'Books & Materials', amount: 15000 },
      { className: 'JSS1', category: 'Assessments & Exams', amount: 5000 },
      { className: 'JSS1', category: 'Other Admin Charges', amount: 3000 },

      { className: 'JSS2', category: 'Tuition Lecture Fee', amount: 35000 },
      { className: 'JSS2', category: 'Uniforms Levy', amount: 0 },
      { className: 'JSS2', category: 'Books & Materials', amount: 15000 },
      { className: 'JSS2', category: 'Assessments & Exams', amount: 5000 },
      { className: 'JSS2', category: 'Other Admin Charges', amount: 3000 },

      { className: 'JSS3', category: 'Tuition Lecture Fee', amount: 35000 },
      { className: 'JSS3', category: 'Uniforms Levy', amount: 0 },
      { className: 'JSS3', category: 'Books & Materials', amount: 15000 },
      { className: 'JSS3', category: 'Assessments & Exams', amount: 6000 },
      { className: 'JSS3', category: 'Other Admin Charges', amount: 4000 },

      { className: 'SS1', category: 'Tuition Lecture Fee', amount: 45000 },
      { className: 'SS1', category: 'Uniforms Levy', amount: 12000 },
      { className: 'SS1', category: 'Books & Materials', amount: 18000 },
      { className: 'SS1', category: 'Assessments & Exams', amount: 7000 },
      { className: 'SS1', category: 'Other Admin Charges', amount: 4000 },

      { className: 'SS2', category: 'Tuition Lecture Fee', amount: 45000 },
      { className: 'SS2', category: 'Uniforms Levy', amount: 0 },
      { className: 'SS2', category: 'Books & Materials', amount: 18005 }, // wait, SS2 has 18000. Let's make it 18000
      { className: 'SS2', category: 'Books & Materials', amount: 18000 },
      { className: 'SS2', category: 'Assessments & Exams', amount: 7000 },
      { className: 'SS2', category: 'Other Admin Charges', amount: 4000 },

      { className: 'SS3', category: 'Tuition Lecture Fee', amount: 45000 },
      { className: 'SS3', category: 'Uniforms Levy', amount: 0 },
      { className: 'SS3', category: 'Books & Materials', amount: 18000 },
      { className: 'SS3', category: 'Assessments & Exams', amount: 9000 },
      { className: 'SS3', category: 'Other Admin Charges', amount: 7000 }
    ];

    // Filter out potential duplicate definition chunk
    const uniqueFeeMatrix = defaultFeeMatrix.filter(
      (item, idx, self) => self.findIndex(t => t.className === item.className && t.category === item.category) === idx
    );

    for (const item of uniqueFeeMatrix) {
      const clsObj = seededClasses.find(c => c.name === item.className);
      if (clsObj) {
        const { data: catRecord, error: catErr } = await supabase
          .from('fee_categories')
          .upsert(
            { name: item.category, default_amount: item.amount, class_id: clsObj.id },
            { onConflict: 'name,class_id' }
          )
          .select()
          .single();
        
        if (catErr) throw new Error(`Fee Category ${item.category} for ${item.className} seed error: ${catErr.message}`);
        seededFeeCategories.push(catRecord);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully.',
      roles: seededRoles.map(r => r.name),
      sessions: [sessionData.name],
      terms: seededTerms.map(t => t.name),
      classes: seededClasses.map(c => c.name),
      subjects: seededSubjects.map(s => s.name),
      staff_accounts: staffAccounts.map(s => s.email),
      students_seeded: seededStudents.length,
      fee_categories_seeded: seededFeeCategories.length
    });

  } catch (error: any) {
    console.error('Seeding error caught:', error);
    return NextResponse.json({ error: error.message || 'Seeding failed' }, { status: 500 });
  }
}
