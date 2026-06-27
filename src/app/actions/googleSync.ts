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

function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current);
        current = '';
      } else if (char === '\r' || char === '\n') {
        row.push(current);
        current = '';
        if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
          lines.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n
        }
      } else {
        current += char;
      }
    }
  }
  if (row.length > 0 || current !== '') {
    row.push(current);
    lines.push(row);
  }
  return lines;
}

async function fetchPublicGoogleSheetCSV(spreadsheetId: string, rangeStr?: string): Promise<string[][]> {
  let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&headers=0`;
  
  if (rangeStr) {
    const parts = rangeStr.split('!');
    if (parts.length === 2) {
      const sheet = parts[0].replace(/['"]/g, '').trim();
      const range = parts[1].trim();
      if (sheet) url += `&sheet=${encodeURIComponent(sheet)}`;
      if (range) url += `&range=${encodeURIComponent(range)}`;
    } else {
      const trimmedRange = rangeStr.trim();
      if (/^[A-Za-z]+[0-9]+:[A-Za-z]+[0-9]+$/.test(trimmedRange)) {
        url += `&range=${encodeURIComponent(trimmedRange)}`;
      } else if (trimmedRange) {
        url += `&sheet=${encodeURIComponent(trimmedRange)}`;
      }
    }
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'text/csv,text/plain',
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`HTTP error fetching public sheet: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  
  if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
    throw new Error('Spreadsheet is private or could not be exported as CSV. Please verify that link sharing is set to "Anyone with the link can view".');
  }

  return parseCSV(csvText);
}

export async function syncGoogleSheetMarks(params: {
  subjectId: string;
  classId: string;
  termId: string;
  sessionId: string;
  spreadsheetId?: string;
  range?: string;
}): Promise<{ success: boolean; recordsSynced?: number; error?: string }> {
  let recordsSyncedCount = 0;
  let syncStatus: 'Success' | 'Failed' = 'Failed';
  let errorMessage: string | null = null;
  let dbUserId: string | null = null;

  const supabase = await createClient();

  try {
    const authData = await verifyTeacherOrAdmin();
    dbUserId = authData.dbUser.id;

    const rawSpreadsheetId = params.spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
    const targetRange = params.range || process.env.GOOGLE_SHEETS_RANGE || 'Sheet1!A2:C100';

    if (!rawSpreadsheetId) {
      throw new Error('Spreadsheet ID is not configured in environment or passed parameters.');
    }

    const spreadsheetIdClean = extractSpreadsheetId(rawSpreadsheetId);

    let rows: any[][] | null = null;
    let publicFetchError: Error | null = null;

    // 1. First, attempt to fetch the public sheet via Google's CSV export endpoint
    try {
      rows = await fetchPublicGoogleSheetCSV(spreadsheetIdClean, targetRange);
    } catch (err: any) {
      publicFetchError = err;
      console.log('Public Google Sheet fetch failed, attempting authenticated service account fetch. Details:', err.message);
    }

    // 2. If public fetch failed, fall back to Google Sheets API with Service Account credentials (if not dummy)
    if (!rows) {
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;

      const isDummyCreds = 
        !clientEmail || 
        !privateKey || 
        clientEmail.includes('dummy') || 
        privateKey.includes('MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC8');

      if (isDummyCreds) {
        throw new Error(
          `Unable to fetch sheet. Since system-wide Google Service Account credentials are not configured or are dummy, ` +
          `the target Google Sheet must be shared as public. Please set the sheet's link sharing to 'Anyone with the link can view' (Public). ` +
          `Details: ${publicFetchError?.message || 'Access denied'}`
        );
      }

      try {
        const auth = new google.auth.JWT({
          email: clientEmail,
          key: privateKey.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetIdClean,
          range: targetRange,
        });

        rows = response.data.values || null;
      } catch (authErr: any) {
        console.error('Authenticated Google Sheet fetch failed:', authErr);
        throw new Error(
          `Failed to sync via both Public CSV and Authenticated methods.\n` +
          `- Public fetch: ${publicFetchError?.message || 'Access denied'}\n` +
          `- Authenticated fetch: ${authErr.message}`
        );
      }
    }

    if (!rows || rows.length === 0) {
      throw new Error('No data found in the spreadsheet range.');
    }

    // Fetch all students in the class from the database to map IDs/Names
    const { data: classStudents, error: stdError } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('class_id', params.classId);

    if (stdError) throw new Error(`Student database query failed: ${stdError.message}`);
    if (!classStudents || classStudents.length === 0) {
      throw new Error('No students found registered in the selected class.');
    }

    // Build mapping directories for both ID and Full Name (case-insensitive and trimmed)
    const idToStudentMap = new Map<string, any>();
    const nameToStudentMap = new Map<string, any>();

    for (const student of classStudents) {
      if (student.id) {
        idToStudentMap.set(student.id.toLowerCase().trim(), student);
      }
      if (student.full_name) {
        nameToStudentMap.set(student.full_name.toLowerCase().trim(), student);
      }
    }

    const resultsToUpsert: any[] = [];
    const unmatchedIdentifiers: string[] = [];

    // 3. Process sheet values & calculate grades
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const studentIdentifier = row[0]?.toString().trim();
      const caRaw = row[1];
      const examRaw = row[2];

      if (!studentIdentifier) {
        continue; // Skip blank rows
      }

      // Check if studentIdentifier matches header words to skip them
      const cleanIdentifier = studentIdentifier.toLowerCase().trim();
      if (
        cleanIdentifier === 'student id' ||
        cleanIdentifier === 'student code' ||
        cleanIdentifier === 'student full name' ||
        cleanIdentifier === 'students full name' ||
        cleanIdentifier === 'student name' ||
        cleanIdentifier === 'full name'
      ) {
        continue;
      }

      // Resolve the student
      let matchedStudent = idToStudentMap.get(cleanIdentifier);
      if (!matchedStudent) {
        matchedStudent = nameToStudentMap.get(cleanIdentifier);
      }

      if (!matchedStudent) {
        unmatchedIdentifiers.push(studentIdentifier);
        console.warn(`Student "${studentIdentifier}" is not registered in the selected class. Skipping.`);
        continue;
      }

      const caParsed = parseFloat(caRaw);
      const examParsed = parseFloat(examRaw);

      if (isNaN(caParsed) || isNaN(examParsed)) {
        throw new Error(`Row ${index + 2} (${studentIdentifier}): Invalid scores. CA: "${caRaw}", Exam: "${examRaw}". Must be numeric.`);
      }

      const caScore = Math.round(caParsed);
      const examScore = Math.round(examParsed);

      // Compute grade using grading engine (will throw error if validation bounds are exceeded)
      const gradingResult = calculateGrade(caScore, examScore);

      resultsToUpsert.push({
        student_id: matchedStudent.id,
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
      if (unmatchedIdentifiers.length > 0) {
        throw new Error(
          `None of the students in the spreadsheet could be mapped to the selected class. Unmatched inputs:\n` +
          unmatchedIdentifiers.slice(0, 5).join(', ') + (unmatchedIdentifiers.length > 5 ? '...' : '')
        );
      }
      throw new Error('No valid records parsed from sheet.');
    }

    const verifiedResults = resultsToUpsert;

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
      user_id: dbUserId,
      details: `Synced marks from sheet for subject ${params.subjectId}. Total records synced: ${recordsSyncedCount}`,
      ip_address: '127.0.0.1',
      user_agent: 'Google Sync Action'
    });

    revalidatePath('/teacher/sync');
    return { success: true, recordsSynced: recordsSyncedCount };

  } catch (error: any) {
    console.error('Google sheet sync failed:', error);
    errorMessage = error.message || 'Unknown synchronization error';
    return { success: false, error: errorMessage ?? undefined };
  } finally {
    // 5. Always record details to google_sheet_sync_logs if authenticated user was verified
    if (dbUserId) {
      await supabase.from('google_sheet_sync_logs').insert({
        teacher_id: dbUserId,
        subject_id: params.subjectId,
        class_id: params.classId,
        status: syncStatus,
        records_synced: recordsSyncedCount,
        error_message: errorMessage
      });
    }
  }
}

