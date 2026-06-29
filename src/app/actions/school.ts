'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

import { GradeResult, calculateGrade } from '@/utils/grading';

// --- Helper to verify roles on the server ---
async function verifyRole(allowedRoles: ('SUPER_ADMIN' | 'TEACHER' | 'BURSAR')[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthenticated user');

  const { data: userData } = await supabase
    .from('users')
    .select('role_id, id')
    .eq('auth_user_id', user.id)
    .single();

  if (!userData) throw new Error('User profile not found');

  const { data: roleData } = await supabase
    .from('roles')
    .select('name')
    .eq('id', userData.role_id)
    .single();

  if (!roleData || !allowedRoles.includes(roleData.name as any)) {
    throw new Error(`Unauthorized: Requires one of [${allowedRoles.join(', ')}] role`);
  }

  return { user, dbUser: userData, role: roleData.name };
}

// --- Student CRUD Operations ---
export async function createStudent(formData: {
  id: string;
  admissionNumber: string;
  fullName: string;
  gender: 'Male' | 'Female';
  dateOfBirth: string;
  address: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  classId: string;
  sessionId: string;
  passportUrl?: string;
}) {
  await verifyRole(['SUPER_ADMIN']);
  const supabase = await createClient();

  const { error } = await supabase.from('students').insert({
    id: formData.id,
    admission_number: formData.admissionNumber,
    full_name: formData.fullName,
    gender: formData.gender,
    date_of_birth: formData.dateOfBirth,
    address: formData.address,
    parent_name: formData.parentName,
    parent_phone: formData.parentPhone,
    parent_email: formData.parentEmail,
    class_id: formData.classId,
    session_id: formData.sessionId,
    passport_url: formData.passportUrl
  });

  if (error) throw new Error(`Create student error: ${error.message}`);
  
  // Create audit log
  const { dbUser } = await verifyRole(['SUPER_ADMIN']);
  await supabase.from('audit_logs').insert({
    action: 'CREATE_STUDENT',
    user_id: dbUser.id,
    details: `Created student ${formData.fullName} with ID ${formData.id}`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/admin/students');
  return { success: true };
}

export async function updateStudent(studentId: string, formData: {
  admissionNumber: string;
  fullName: string;
  gender: 'Male' | 'Female';
  dateOfBirth: string;
  address: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  classId: string;
  sessionId: string;
  passportUrl?: string;
}) {
  await verifyRole(['SUPER_ADMIN']);
  const supabase = await createClient();

  const { error } = await supabase
    .from('students')
    .update({
      admission_number: formData.admissionNumber,
      full_name: formData.fullName,
      gender: formData.gender,
      date_of_birth: formData.dateOfBirth,
      address: formData.address,
      parent_name: formData.parentName,
      parent_phone: formData.parentPhone,
      parent_email: formData.parentEmail,
      class_id: formData.classId,
      session_id: formData.sessionId,
      passport_url: formData.passportUrl,
      updated_at: new Date().toISOString()
    })
    .eq('id', studentId);

  if (error) throw new Error(`Update student error: ${error.message}`);

  const { dbUser } = await verifyRole(['SUPER_ADMIN']);
  await supabase.from('audit_logs').insert({
    action: 'UPDATE_STUDENT',
    user_id: dbUser.id,
    details: `Updated student ${formData.fullName} (${studentId})`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/admin/students');
  return { success: true };
}

export async function deleteStudent(studentId: string) {
  await verifyRole(['SUPER_ADMIN']);
  const supabase = await createClient();

  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) throw new Error(`Delete student error: ${error.message}`);

  const { dbUser } = await verifyRole(['SUPER_ADMIN']);
  await supabase.from('audit_logs').insert({
    action: 'DELETE_STUDENT',
    user_id: dbUser.id,
    details: `Deleted student ${studentId}`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/admin/students');
  return { success: true };
}

// --- Result Access Token Operations ---
export async function generateResultToken(studentId: string, maxUsage: number = 3) {
  const { dbUser } = await verifyRole(['SUPER_ADMIN']);
  const supabase = await createClient();

  // Generate random 8 character string
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
  let tokenString = '';
  for (let i = 0; i < 8; i++) {
    tokenString += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

  const { data, error } = await supabase
    .from('tokens')
    .insert({
      token_string: tokenString,
      student_id: studentId,
      max_usage: maxUsage,
      usage_count: 0,
      status: 'Active',
      generated_by: dbUser.id,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(`Token generation error: ${error.message}`);

  await supabase.from('audit_logs').insert({
    action: 'GENERATE_TOKEN',
    user_id: dbUser.id,
    details: `Generated access token for student ${studentId}`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/admin/tokens');
  return { success: true, token: data };
}

// --- Bursar Payment Engine ---
export async function recordPayment(paymentData: {
  studentId: string;
  category: string; // 'Tuition', 'ICT', etc.
  amountPaid: number;
}) {
  const { dbUser } = await verifyRole(['BURSAR', 'SUPER_ADMIN']);
  const supabase = await createClient();

  // 1. Fetch Student class to find expected fee
  const { data: student, error: stdErr } = await supabase
    .from('students')
    .select('class_id, full_name')
    .eq('id', paymentData.studentId)
    .single();

  if (stdErr || !student) throw new Error('Student profile not found');

  // 2. Fetch Fee Category configured amount
  const { data: feeCategory, error: feeErr } = await supabase
    .from('fee_categories')
    .select('default_amount')
    .eq('class_id', student.class_id)
    .eq('name', paymentData.category)
    .single();

  if (feeErr || !feeCategory) {
    throw new Error(`Fee Category '${paymentData.category}' is not configured for this student's class.`);
  }

  const totalExpected = feeCategory.default_amount;

  // 3. Calculate previous payments to determine updated balance
  const { data: pastPayments, error: pastErr } = await supabase
    .from('payments')
    .select('amount_paid')
    .eq('student_id', paymentData.studentId)
    .eq('category', paymentData.category);

  if (pastErr) throw new Error('Error retrieving payment history');

  const totalAlreadyPaid = pastPayments?.reduce((acc, curr) => acc + curr.amount_paid, 0) || 0;
  const newTotalPaid = totalAlreadyPaid + paymentData.amountPaid;
  const balance = Math.max(0.0, totalExpected - newTotalPaid);

  // 4. Generate transaction receipt code
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randCode = Math.floor(1000 + Math.random() * 9000);
  const receiptNumber = `REC-${dateStr}-${randCode}`;

  const { data: paymentRecord, error: payErr } = await supabase
    .from('payments')
    .insert({
      student_id: paymentData.studentId,
      amount_paid: paymentData.amountPaid,
      total_expected: totalExpected,
      balance: balance,
      category: paymentData.category,
      receipt_number: receiptNumber,
      recorded_by: dbUser.id
    })
    .select()
    .single();

  if (payErr) throw new Error(`Database error saving payment: ${payErr.message}`);

  await supabase.from('audit_logs').insert({
    action: 'RECORD_PAYMENT',
    user_id: dbUser.id,
    details: `Recorded payment of N${paymentData.amountPaid} for category ${paymentData.category} (Student: ${student.full_name})`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/bursar/payments');
  return { success: true, payment: paymentRecord };
}

// --- Fee Categories Configurator Action ---
export async function upsertFeeCategories(fees: { classId: string; name: string; amount: number }[]) {
  const { dbUser } = await verifyRole(['BURSAR', 'SUPER_ADMIN']);
  const supabase = await createClient();

  const upsertRecords = fees.map(f => ({
    class_id: f.classId,
    name: f.name,
    default_amount: f.amount
  }));

  const { error } = await supabase
    .from('fee_categories')
    .upsert(upsertRecords, { onConflict: 'name,class_id' });

  if (error) {
    throw new Error(`Failed to save fee configurations: ${error.message}`);
  }

  await supabase.from('audit_logs').insert({
    action: 'CONFIGURE_FEES',
    user_id: dbUser.id,
    details: `Updated institutional fee categories configuration matrix.`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/bursar/fees');
  return { success: true };
}

// --- Manual Student Marks Saving Action ---
export async function saveStudentMarks(
  subjectId: string,
  termId: string,
  sessionId: string,
  marks: { studentId: string; caScore: number; examScore: number }[]
) {
  const { dbUser } = await verifyRole(['TEACHER', 'SUPER_ADMIN']);
  const supabase = await createClient();

  const resultsToUpsert = marks.map((m) => {
    const caRounded = Math.round(m.caScore);
    const examRounded = Math.round(m.examScore);
    const grading = calculateGrade(caRounded, examRounded);
    return {
      student_id: m.studentId,
      subject_id: subjectId,
      term_id: termId,
      session_id: sessionId,
      ca_score: caRounded,
      exam_score: examRounded,
      total_score: grading.totalScore,
      grade: grading.grade,
      remark: grading.remark
    };
  });

  const { error } = await supabase
    .from('results')
    .upsert(resultsToUpsert, { onConflict: 'student_id,subject_id,term_id,session_id' });

  if (error) {
    throw new Error(`Failed to save student marks: ${error.message}`);
  }

  await supabase.from('audit_logs').insert({
    action: 'SAVE_MARKS_MANUAL',
    user_id: dbUser.id,
    details: `Manually recorded student scores. Records count: ${resultsToUpsert.length}`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/teacher/results');
  return { success: true };
}

export async function updateTermResumptionDate(termId: string, nextTermBegins: string) {
  const { dbUser } = await verifyRole(['SUPER_ADMIN']);
  const supabase = await createClient();

  const { error } = await supabase
    .from('terms')
    .update({ next_term_begins: nextTermBegins })
    .eq('id', termId);

  if (error) {
    throw new Error(`Failed to update term resumption date: ${error.message}`);
  }

  await supabase.from('audit_logs').insert({
    action: 'UPDATE_TERM_RESUMPTION',
    user_id: dbUser.id,
    details: `Updated term next term begins date to: ${nextTermBegins}`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/admin');
  return { success: true };
}

export async function createSubject(name: string, description?: string) {
  const { dbUser } = await verifyRole(['TEACHER', 'SUPER_ADMIN']);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('subjects')
    .insert({
      name: name.trim(),
      description: description?.trim() || null
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Subject "${name}" already exists.`);
    }
    throw new Error(`Failed to create subject: ${error.message}`);
  }

  await supabase.from('audit_logs').insert({
    action: 'CREATE_SUBJECT',
    user_id: dbUser.id,
    details: `Created subject "${name}"`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/teacher');
  return { success: true, subject: data };
}

export async function updateSubject(id: string, name: string, description?: string) {
  const { dbUser } = await verifyRole(['TEACHER', 'SUPER_ADMIN']);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('subjects')
    .update({
      name: name.trim(),
      description: description?.trim() || null
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Subject "${name}" already exists.`);
    }
    throw new Error(`Failed to update subject: ${error.message}`);
  }

  await supabase.from('audit_logs').insert({
    action: 'UPDATE_SUBJECT',
    user_id: dbUser.id,
    details: `Updated subject ID ${id} to "${name}"`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/teacher');
  return { success: true, subject: data };
}

export async function setActiveAcademicPeriod(sessionId: string, termId: string) {
  const { dbUser } = await verifyRole(['SUPER_ADMIN']);
  const supabase = await createClient();

  // Fetch the current active term and session before we change them
  const { data: currentActiveTerm } = await supabase
    .from('terms')
    .select('name')
    .eq('is_active', true)
    .maybeSingle();

  const { data: currentActiveSession } = await supabase
    .from('sessions')
    .select('name')
    .eq('is_active', true)
    .maybeSingle();

  // Check if the third term of the active session is completed (moving away from it)
  if (currentActiveTerm?.name.toLowerCase().includes('third') && currentActiveSession?.name) {
    const sessionName = currentActiveSession.name;
    const parts = sessionName.split('/');
    if (parts.length === 2) {
      const year1 = parseInt(parts[0], 10);
      const year2 = parseInt(parts[1], 10);
      if (!isNaN(year1) && !isNaN(year2)) {
        const nextSessionName = `${year1 + 1}/${year2 + 1}`;
        
        const { data: existingSession } = await supabase
          .from('sessions')
          .select('id')
          .eq('name', nextSessionName)
          .maybeSingle();
          
        if (!existingSession) {
          await supabase
            .from('sessions')
            .insert({ name: nextSessionName, is_active: false });
            
          await supabase.from('audit_logs').insert({
            action: 'AUTO_CREATE_SESSION',
            user_id: dbUser.id,
            details: `Automatically created next session "${nextSessionName}" after completion of Third Term of "${sessionName}"`,
            ip_address: '127.0.0.1',
            user_agent: 'Server Action'
          });
        }
      }
    }
  }

  // Set all sessions to inactive
  const { error: sessDeactErr } = await supabase
    .from('sessions')
    .update({ is_active: false })
    .neq('id', sessionId); // Update all others
  
  if (sessDeactErr) throw new Error(`Deactivating sessions failed: ${sessDeactErr.message}`);

  // Set selected session to active
  const { error: sessActErr } = await supabase
    .from('sessions')
    .update({ is_active: true })
    .eq('id', sessionId);

  if (sessActErr) throw new Error(`Activating session failed: ${sessActErr.message}`);

  // Set all terms to inactive
  const { error: termDeactErr } = await supabase
    .from('terms')
    .update({ is_active: false })
    .neq('id', termId);

  if (termDeactErr) throw new Error(`Deactivating terms failed: ${termDeactErr.message}`);

  // Set selected term to active
  const { error: termActErr } = await supabase
    .from('terms')
    .update({ is_active: true })
    .eq('id', termId);

  if (termActErr) throw new Error(`Activating term failed: ${termActErr.message}`);

  await supabase.from('audit_logs').insert({
    action: 'SET_ACTIVE_PERIOD',
    user_id: dbUser.id,
    details: `Set active session ID ${sessionId} and active term ID ${termId}`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/admin');
  revalidatePath('/teacher');
  return { success: true };
}

export async function createSession(name: string) {
  const { dbUser } = await verifyRole(['SUPER_ADMIN']);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      name: name.trim(),
      is_active: false
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Session "${name}" already exists.`);
    }
    throw new Error(`Failed to create session: ${error.message}`);
  }

  await supabase.from('audit_logs').insert({
    action: 'CREATE_SESSION',
    user_id: dbUser.id,
    details: `Created session "${name}"`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/admin');
  return { success: true, session: data };
}

export async function createClass(name: string, level: 'JUNIOR' | 'SENIOR') {
  const { dbUser } = await verifyRole(['SUPER_ADMIN']);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('classes')
    .insert({
      name: name.trim().toUpperCase(),
      level: level
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Class "${name}" already exists.`);
    }
    throw new Error(`Failed to create class: ${error.message}`);
  }

  await supabase.from('audit_logs').insert({
    action: 'CREATE_CLASS',
    user_id: dbUser.id,
    details: `Created class "${name}" (${level})`,
    ip_address: '127.0.0.1',
    user_agent: 'Server Action'
  });

  revalidatePath('/admin');
  return { success: true, class: data };
}






