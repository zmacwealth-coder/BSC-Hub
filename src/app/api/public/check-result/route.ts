import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

// 5 requests per minute rolling rate limiter
const ipCache = new Map<string, { count: number; windowStart: number }>();
const WINDOW_SIZE_MS = 60 * 1000;
const MAX_REQUESTS = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const clientData = ipCache.get(ip);

  if (!clientData) {
    ipCache.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (now - clientData.windowStart > WINDOW_SIZE_MS) {
    ipCache.set(ip, { count: 1, windowStart: now });
    return false;
  }

  clientData.count++;
  if (clientData.count > MAX_REQUESTS) {
    return true;
  }

  return false;
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

  if (checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts. You are rate-limited to 5 requests per minute.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { studentId, tokenString, visitorName, termId, sessionId } = body;

    if (!studentId || !tokenString || !visitorName) {
      return NextResponse.json(
        { error: 'Missing required parameters: studentId, tokenString, and visitorName are required.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Fetch token record
    const { data: tokenData, error: tokenErr } = await supabase
      .from('tokens')
      .select('*')
      .eq('token_string', tokenString.trim())
      .single();

    if (tokenErr || !tokenData) {
      return NextResponse.json({ error: 'Invalid access token.' }, { status: 403 });
    }

    // 2. Validate token state
    if (tokenData.student_id !== studentId.trim()) {
      return NextResponse.json({ error: 'Token is not registered for this student ID.' }, { status: 403 });
    }

    if (tokenData.status !== 'Active') {
      return NextResponse.json({ error: `This token is no longer active. Status: ${tokenData.status}` }, { status: 403 });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      // Update token status to Expired
      await supabase.from('tokens').update({ status: 'Expired' }).eq('id', tokenData.id);
      return NextResponse.json({ error: 'This token has expired.' }, { status: 403 });
    }

    if (tokenData.usage_count >= tokenData.max_usage) {
      // Update token status to Consumed
      await supabase.from('tokens').update({ status: 'Consumed' }).eq('id', tokenData.id);
      return NextResponse.json({ error: 'This token has reached its maximum usage limit.' }, { status: 403 });
    }

    // 3. Retrieve active term and session if not specified
    let targetTermId = termId;
    let targetSessionId = sessionId;

    if (!targetTermId) {
      const { data: activeTerm } = await supabase.from('terms').select('id').eq('is_active', true).single();
      targetTermId = activeTerm?.id;
    }
    if (!targetSessionId) {
      const { data: activeSession } = await supabase.from('sessions').select('id').eq('is_active', true).single();
      targetSessionId = activeSession?.id;
    }

    if (!targetTermId || !targetSessionId) {
      return NextResponse.json({ error: 'No active scholastic term or session configured.' }, { status: 500 });
    }

    // 4. Retrieve student profile and class metadata
    const { data: studentData, error: stdErr } = await supabase
      .from('students')
      .select('id, admission_number, full_name, gender, parent_name, class_id, classes(name)')
      .eq('id', studentId)
      .single();

    if (stdErr || !studentData) {
      return NextResponse.json({ error: 'Student record not found.' }, { status: 404 });
    }

    // 5. Retrieve academic scores for the selected term and session
    const { data: resultsData, error: resultsErr } = await supabase
      .from('results')
      .select('ca_score, exam_score, total_score, grade, remark, subjects(name)')
      .eq('student_id', studentId)
      .eq('term_id', targetTermId)
      .eq('session_id', targetSessionId);

    if (resultsErr) {
      return NextResponse.json({ error: 'Failed to retrieve results: ' + resultsErr.message }, { status: 500 });
    }

    // 6. Update usage stats & write to token_usage_logs
    const nextUsageCount = tokenData.usage_count + 1;
    const isNowConsumed = nextUsageCount >= tokenData.max_usage;
    
    const { error: updateTokenErr } = await supabase
      .from('tokens')
      .update({
        usage_count: nextUsageCount,
        status: isNowConsumed ? 'Consumed' : 'Active'
      })
      .eq('id', tokenData.id);

    if (updateTokenErr) {
      return NextResponse.json({ error: 'Failed to update token usage.' }, { status: 500 });
    }

    // Insert usage log
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    await supabase.from('token_usage_logs').insert({
      token_id: tokenData.id,
      visitor_name: visitorName,
      ip_address: ip,
      user_agent: userAgent
    });

    // Format results to match the required API contract
    const formattedResults = resultsData.map(r => ({
      subjectName: (r.subjects as any)?.name || 'Unknown Subject',
      caScore: r.ca_score,
      examScore: r.exam_score,
      totalScore: r.total_score,
      grade: r.grade,
      remark: r.remark
    }));

    return NextResponse.json({
      success: true,
      student: {
        id: studentData.id,
        admissionNumber: studentData.admission_number,
        fullName: studentData.full_name,
        gender: studentData.gender,
        className: (studentData.classes as any)?.name || 'Unknown Class',
        parentName: studentData.parent_name
      },
      results: formattedResults,
      usageStats: {
        currentUsage: nextUsageCount,
        maxUsageAllowed: tokenData.max_usage
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
