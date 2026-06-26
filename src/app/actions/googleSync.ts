'use server';

import { google } from 'googleapis';
import { createClient } from '@/utils/supabase/server';
import { calculateGrade } from '@/utils/grading';
import { revalidatePath } from 'next/cache';

// Helper to verify user is authorized (TEACHER or SUPER_ADMIN)
async function verifyTeacherOrAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthenticated');

  const { data: dbUser } = await supabase
    .from('users')
    .select('id, role_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!dbUser) throw new Error('User profile not found');

  const { data: role } = await supabase
    .from('roles')
    .select('name')
    .eq('id', dbUser.role_id)
    .single();

  if (!role || (role.name !== 'TEACHER' && role.name !== 'SUPER_ADMIN')) {
    throw new Error('Unauthorized: Requires Teacher or Admin role');
  }

  return { user, dbUser, roleName: role.name };
}

export async function syncGoogleSheetMarks(params: {
  subjectId: string;
  classId: string;
  termId: string;
  sessionId: string;
  spreadsheetId?: string;
  range?: string;
}) {
  const { dbUser } = await verifyTeacherOrAdmin();
  const supabase = await createClient();

  const targetSpreadsheetId = params.spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
  const targetRange = params.range || process.env.GOOGLE_SHEETS_RANGE || 'Sheet1!A2:C100';

  if (!targetSpreadsheetId) {
    throw new Error('Spreadsheet ID is not configured in environment or passed parameters.');
  }

  let recordsSyncedCount = 0;
  let syncStatus: 'Success' | 'Failed' = 'Failed';
  let errorMessage: string | null = null;

  try {
    // 1. Google Sheets API Authorization
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      throw new Error('Google Service Account credentials (email/private key) are missing from system environments.');
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 2. Fetch sheet values
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSpreadsheetId,
      range: targetRange,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      throw new Error('No data found in the spreadsheet range.');
    }

    const resultsToUpsert: any[] = [];

    // 3. Process sheet values & calculate grades
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const studentId = row[0]?.toString().trim();
      const caRaw = row[1];
      const examRaw = row[2];

      if (!studentId) {
        continue; // Skip blank rows
      }

      const caParsed = parseFloat(caRaw);
      const examParsed = parseFloat(examRaw);

      if (isNaN(caParsed) || isNaN(examParsed)) {
        throw new Error(`Row ${index + 2}: Invalid scores. CA: "${caRaw}", Exam: "${examRaw}". Must be numeric.`);
      }

      const caScore = Math.round(caParsed);
      const examScore = Math.round(examParsed);

      // Compute grade using grading engine (will throw error if validation bounds are exceeded)
      const gradingResult = calculateGrade(caScore, examScore);

      resultsToUpsert.push({
        student_id: studentId,
        subject_id: params.subjectId,
        term_id: params.termId,
        session_id: params.sessionId,
        ca_score: caScore,
        exam_score: examScore,
        total_score: gradingResult.totalScore,
        grade: gradingResult.grade,
        remark: gradingResult.remark
      });
    }

    if (resultsToUpsert.length === 0) {
      throw new Error('No valid records parsed from sheet.');
    }

    // Verify all student IDs exist in this class before bulk upserting (optional integrity check)
    const studentIds = resultsToUpsert.map(r => r.student_id);
    const { data: validStudents, error: stdError } = await supabase
      .from('students')
      .select('id')
      .in('id', studentIds)
      .eq('class_id', params.classId);

    if (stdError) throw new Error(`Student verification error: ${stdError.message}`);
    const validStudentIdsSet = new Set(validStudents?.map(s => s.id) || []);

    // Filter results to only valid students
    const verifiedResults = resultsToUpsert.filter(r => {
      const isValid = validStudentIdsSet.has(r.student_id);
      if (!isValid) {
        console.warn(`Student ID ${r.student_id} is not registered in the selected class. Skipping.`);
      }
      return isValid;
    });

    if (verifiedResults.length === 0) {
      throw new Error('None of the student IDs in the spreadsheet belong to the selected class.');
    }

    // 4. Bulk upsert within database
    const { error: upsertError } = await supabase
      .from('results')
      .upsert(verifiedResults, { onConflict: 'student_id,subject_id,term_id,session_id' });

    if (upsertError) {
      throw new Error(`Bulk upsert failed: ${upsertError.message}`);
    }

    recordsSyncedCount = verifiedResults.length;
    syncStatus = 'Success';
    
    // Create Audit Log
    await supabase.from('audit_logs').insert({
      action: 'SHEET_SYNC',
      user_id: dbUser.id,
      details: `Synced marks from sheet for subject ${params.subjectId}. Total records synced: ${recordsSyncedCount}`,
      ip_address: '127.0.0.1',
      user_agent: 'Google Sync Action'
    });

    revalidatePath('/teacher/sync');
    return { success: true, recordsSynced: recordsSyncedCount };

  } catch (error: any) {
    console.error('Google sheet sync failed:', error);
    syncStatus = 'Failed';
    errorMessage = error.message || 'Unknown synchronization error';
    throw error;
  } finally {
    // 5. Always record details to google_sheet_sync_logs
    await supabase.from('google_sheet_sync_logs').insert({
      teacher_id: dbUser.id,
      subject_id: params.subjectId,
      class_id: params.classId,
      status: syncStatus,
      records_synced: recordsSyncedCount,
      error_message: errorMessage
    });
  }
}
