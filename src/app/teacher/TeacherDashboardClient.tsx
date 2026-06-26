'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { syncGoogleSheetMarks } from '@/app/actions/googleSync';
import { saveStudentMarks } from '@/app/actions/school';
import {
  FileSpreadsheet,
  Layers,
  Calendar,
  LogOut,
  RefreshCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Eye,
  History,
  BookOpen,
  CheckSquare,
  Download,
  Lock
} from 'lucide-react';
import { activeSchoolConfig } from '@/config/whiteLabel.config';

export default function TeacherDashboardClient({
  classes,
  subjects,
  sessions,
  terms,
  initialSyncLogs,
  initialResults,
  students
}: {
  classes: any[];
  subjects: any[];
  sessions: any[];
  terms: any[];
  initialSyncLogs: any[];
  initialResults: any[];
  students: any[];
}) {
  const [activeTab, setActiveTab] = useState<'sync' | 'results' | 'logs' | 'manual' | 'security'>('sync');
  
  // Selection States
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || '');
  const [selectedTermId, setSelectedTermId] = useState(terms.find(t => t.is_active)?.id || terms[0]?.id || '');
  const [selectedSessionId, setSelectedSessionId] = useState(sessions.find(s => s.is_active)?.id || sessions[0]?.id || '');
  
  // Sheet sync form state
  const [spreadsheetId, setSpreadsheetId] = useState(process.env.NEXT_PUBLIC_GOOGLE_SPREADSHEET_ID || '');
  const [sheetRange, setSheetRange] = useState('Sheet1!A2:C100');

  // Logs & scores states
  const [syncLogs, setSyncLogs] = useState<any[]>(initialSyncLogs);
  const [results, setResults] = useState<any[]>(initialResults);

  // Manual Input State Matrix
  const [manualMarks, setManualMarks] = useState<Record<string, { caScore: number; examScore: number }>>({});

  // Loaders
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const [teacherNewPassword, setTeacherNewPassword] = useState('');
  const [teacherConfirmPassword, setTeacherConfirmPassword] = useState('');
  const [teacherPassError, setTeacherPassError] = useState<string | null>(null);
  const [teacherPassSuccess, setTeacherPassSuccess] = useState<string | null>(null);

  const handleTeacherChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherPassError(null);
    setTeacherPassSuccess(null);

    if (teacherNewPassword.length < 6) {
      setTeacherPassError('Password must be at least 6 characters long.');
      return;
    }

    if (teacherNewPassword !== teacherConfirmPassword) {
      setTeacherPassError('Passwords do not match.');
      return;
    }

    setIsSyncing(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: teacherNewPassword });
      if (error) throw error;
      setTeacherPassSuccess('Password updated successfully!');
      setTeacherNewPassword('');
      setTeacherConfirmPassword('');
    } catch (err: any) {
      setTeacherPassError(err.message || 'Failed to update password.');
    } finally {
      setIsSyncing(false);
    }
  };

  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Filter students in the currently selected class
  const classStudents = students.filter(s => s.class_id === selectedClassId);

  // Synchronize manual input states when selections or results change
  useEffect(() => {
    const initialMarks: Record<string, { caScore: number; examScore: number }> = {};
    classStudents.forEach(std => {
      const existing = results.find(
        r => r.student_id === std.id &&
             r.subject_id === selectedSubjectId &&
             r.term_id === selectedTermId &&
             r.session_id === selectedSessionId
      );
      initialMarks[std.id] = {
        caScore: existing ? existing.ca_score : 0,
        examScore: existing ? existing.exam_score : 0
      };
    });
    setManualMarks(initialMarks);
    setSyncError(null);
    setSyncSuccessMsg(null);
  }, [selectedClassId, selectedSubjectId, selectedTermId, selectedSessionId, results]);

  const handleSyncMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccessMsg(null);

    try {
      const result = await syncGoogleSheetMarks({
        subjectId: selectedSubjectId,
        classId: selectedClassId,
        termId: selectedTermId,
        sessionId: selectedSessionId,
        spreadsheetId: spreadsheetId.trim() || undefined,
        range: sheetRange.trim() || undefined
      });

      if (result.success) {
        setSyncSuccessMsg(`Successfully synchronized ${result.recordsSynced} student scores!`);
        
        // Fetch refreshed sync logs from database
        const { data: newLogs } = await supabase
          .from('google_sheet_sync_logs')
          .select('*, subjects(name), classes(name)')
          .order('sync_time', { ascending: false })
          .limit(20);
        if (newLogs) setSyncLogs(newLogs);

        // Fetch refreshed results
        const { data: newResults } = await supabase
          .from('results')
          .select('*, students(full_name, class_id), subjects(name)')
          .order('created_at', { ascending: false });
        if (newResults) setResults(newResults);
      }
    } catch (err: any) {
      setSyncError(err.message || 'Failed to synchronize spreadsheet.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveManualMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccessMsg(null);

    try {
      const marksList = Object.entries(manualMarks).map(([studentId, scores]) => ({
        studentId,
        caScore: scores.caScore,
        examScore: scores.examScore
      }));

      // Validation bounds check
      for (const m of marksList) {
        if (!Number.isInteger(m.caScore) || m.caScore < 0 || m.caScore > 30) {
          throw new Error(`Validation Error: Student ${m.studentId} CA score must be an integer between 0 and 30.`);
        }
        if (!Number.isInteger(m.examScore) || m.examScore < 0 || m.examScore > 70) {
          throw new Error(`Validation Error: Student ${m.studentId} Exam score must be an integer between 0 and 70.`);
        }
      }

      const res = await saveStudentMarks(selectedSubjectId, selectedTermId, selectedSessionId, marksList);
      if (res.success) {
        setSyncSuccessMsg('Successfully saved student marks manually!');
        
        // Fetch refreshed results
        const { data: newResults } = await supabase
          .from('results')
          .select('*, students(full_name, class_id), subjects(name)')
          .order('created_at', { ascending: false });
        if (newResults) setResults(newResults);
      }
    } catch (err: any) {
      setSyncError(err.message || 'Failed to save student marks.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Client-side live calculation mapping
  const getLiveCalculatedScore = (ca: number, exam: number) => {
    const total = ca + exam;
    let grade = 'F';
    let remark = 'Fail';
    if (total >= 70) { grade = 'A'; remark = 'Excellent'; }
    else if (total >= 60) { grade = 'B'; remark = 'Very Good'; }
    else if (total >= 50) { grade = 'C'; remark = 'Good'; }
    else if (total >= 40) { grade = 'P'; remark = 'Pass'; }
    return { total, grade, remark };
  };

  // Filter results according to selections for reviewing
  const filteredResults = results.filter(
    (res) =>
      res.students?.class_id === selectedClassId &&
      res.subject_id === selectedSubjectId &&
      res.term_id === selectedTermId &&
      res.session_id === selectedSessionId
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0">
        <div>
          {/* Header */}
          <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded-xl flex items-center justify-center font-bold text-white text-sm shadow">
              BSC
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white tracking-tight leading-tight">Teacher Portal</h2>
              <p className="text-[10px] text-slate-500 font-medium">Bright Success College</p>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('sync')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'sync' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="h-4.5 w-4.5" /> Marksheet Syncer
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'manual' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckSquare className="h-4.5 w-4.5" /> Manual Entry
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'results' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="h-4.5 w-4.5" /> Review Scores
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'logs' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="h-4.5 w-4.5" /> Synchronization Logs
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'security' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="h-4.5 w-4.5" /> Account Security
            </button>
          </nav>
        </div>

        {/* User sign-out info */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800/80">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
          >
            <LogOut className="h-4.5 w-4.5" /> End Teacher Session
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-slate-100 px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-slate-800">
            {activeTab === 'sync' 
              ? 'Google Marksheet Syncer' 
              : activeTab === 'manual' 
              ? 'Manual Score Entry'
              : activeTab === 'results' 
              ? 'Student Scores Ledger' 
              : activeTab === 'security'
              ? 'Account Security Settings'
              : 'Synchronization Audits'}
          </h2>
          <div className="text-xs text-slate-400 font-semibold">
            Institutional Deployment: <span className="text-secondary">{activeSchoolConfig.name}</span>
          </div>
        </header>

        <div className="p-8 max-w-6xl w-full mx-auto">
          {/* TAB 1: MARKSHEET SYNCER */}
          {activeTab === 'sync' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form panel */}
              <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4 h-fit">
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileSpreadsheet className="h-5 w-5 text-primary" /> Sheets Integration
                </h3>
                <form onSubmit={handleSyncMarks} className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Subject</label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                    >
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Target Class</label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                    >
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Session</label>
                      <select
                        value={selectedSessionId}
                        onChange={(e) => setSelectedSessionId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none bg-white"
                      >
                        {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Term</label>
                      <select
                        value={selectedTermId}
                        onChange={(e) => setSelectedTermId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none bg-white"
                      >
                        {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Google Spreadsheet ID</label>
                    <input
                      type="text"
                      placeholder="Enter Spreadsheet ID"
                      required
                      value={spreadsheetId}
                      onChange={(e) => setSpreadsheetId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Cell Range</label>
                    <input
                      type="text"
                      placeholder="e.g. Sheet1!A2:C100"
                      required
                      value={sheetRange}
                      onChange={(e) => setSheetRange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {syncError && (
                    <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 flex gap-2 items-start text-xs font-medium">
                      <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                      <span>{syncError}</span>
                    </div>
                  )}

                  {syncSuccessMsg && (
                    <div className="bg-green-50 text-green-700 border border-green-200 rounded-xl p-3 flex gap-2 items-start text-xs font-medium">
                      <CheckCircle2 className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                      <span>{syncSuccessMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSyncing}
                    className="w-full py-3 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-xl transition shadow disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4.5 w-4.5 animate-spin" /> Synchronizing...
                      </>
                    ) : (
                      <>
                        <RefreshCcw className="h-4.5 w-4.5" /> Trigger Ingestion Sync
                      </>
                    )}
                  </button>

                  {/* Dynamic Template CSV Exporter */}
                  <button
                    type="button"
                    onClick={() => {
                      const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || 'Class';
                      const headers = ['Student ID', 'CA Score (Max 30)', 'Exam Score (Max 70)'];
                      const csvRows = classStudents.map(s => [s.id, '', '']);
                      const csvContent = "data:text/csv;charset=utf-8," 
                        + [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
                      
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `BSC_Template_${selectedClassName}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 mt-2"
                  >
                    <Download className="h-3.5 w-3.5" /> Download CSV Marksheet Template
                  </button>
                </form>
              </div>

              {/* Instructions Panel */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex gap-4 text-slate-700">
                  <HelpCircle className="h-6 w-6 text-secondary shrink-0" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-blue-900 text-sm">Sheets marksheets guidelines</h4>
                    <p className="text-xs leading-relaxed text-blue-800">
                      Your Google Spreadsheet must contain columns in this specific layout:
                    </p>
                    <ul className="text-xs list-disc list-inside text-blue-800 space-y-1 pt-1.5">
                      <li>Column A: **Student Code** (e.g. `BSC-2026-0001`)</li>
                      <li>Column B: **CA Score** (Numeric, maximum of 30.0)</li>
                      <li>Column C: **Exam Score** (Numeric, maximum of 70.0)</li>
                    </ul>
                    <p className="text-xs text-blue-800 pt-2 font-medium">
                      You can click **"Download CSV Marksheet Template"** to download a template pre-filled with the active class student codes, copy those into your Google Spreadsheet, enter grades, and trigger the sync.
                    </p>
                  </div>
                </div>

                {/* Short preview of last logs */}
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden p-6 space-y-3">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1">
                    <History className="h-4 w-4 text-slate-400" /> Recent Sync Events
                  </h4>
                  <div className="space-y-2">
                    {syncLogs.slice(0, 3).map((log) => (
                      <div key={log.id} className="text-xs flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                        <div>
                          <span className="font-bold text-slate-800">{log.subjects?.name}</span> ({log.classes?.name})
                          <span className="text-[10px] text-slate-400 block">{new Date(log.sync_time).toLocaleString()}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'Success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {log.status === 'Success' ? `${log.records_synced} synced` : 'Failed'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL SCORE ENTRY */}
          {activeTab === 'manual' && (
            <div className="space-y-6">
              {/* Form details selection */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-wrap gap-4 text-sm items-center justify-between">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-semibold">Subject:</span>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 bg-white"
                    >
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-semibold">Class:</span>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 bg-white"
                    >
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-semibold">Term:</span>
                    <select
                      value={selectedTermId}
                      onChange={(e) => setSelectedTermId(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 bg-white"
                    >
                      {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleSaveManualMarks}
                  disabled={isSyncing || classStudents.length === 0}
                  className="px-6 py-2.5 bg-secondary hover:bg-secondary-hover text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Student Marks'
                  )}
                </button>
              </div>

              {syncError && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 flex gap-2 items-start text-xs font-medium">
                  <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                  <span>{syncError}</span>
                </div>
              )}

              {syncSuccessMsg && (
                <div className="bg-green-50 text-green-700 border border-green-200 rounded-xl p-3 flex gap-2 items-start text-xs font-medium">
                  <CheckCircle2 className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                  <span>{syncSuccessMsg}</span>
                </div>
              )}

              {/* Grid table */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto text-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase border-b border-slate-150">
                        <th className="py-3.5 px-6">Student ID</th>
                        <th className="py-3.5 px-6">Student Name</th>
                        <th className="py-3.5 px-6 text-center">CA Score (Max 30)</th>
                        <th className="py-3.5 px-6 text-center">Exam Score (Max 70)</th>
                        <th className="py-3.5 px-6 text-center font-bold">Total (100)</th>
                        <th className="py-3.5 px-6 text-center font-bold">Grade</th>
                        <th className="py-3.5 px-6">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {classStudents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 px-6 text-center text-slate-400 font-semibold">
                            No students registered in this class. Set students under Administrator portal.
                          </td>
                        </tr>
                      ) : (
                        classStudents.map((std) => {
                          const mark = manualMarks[std.id] || { caScore: 0, examScore: 0 };
                          const live = getLiveCalculatedScore(mark.caScore, mark.examScore);

                          return (
                            <tr key={std.id} className="hover:bg-slate-50/50 transition">
                              <td className="py-4 px-6 font-bold text-slate-900">{std.id}</td>
                              <td className="py-4 px-6 font-semibold text-slate-800">{std.full_name}</td>
                              
                              <td className="py-3 px-4 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={30}
                                  step="1"
                                  value={mark.caScore}
                                  onChange={(e) => {
                                    const parsed = parseFloat(e.target.value);
                                    const val = isNaN(parsed) ? 0 : Math.min(30, Math.max(0, Math.round(parsed)));
                                    setManualMarks(prev => ({
                                      ...prev,
                                      [std.id]: { ...prev[std.id], caScore: val }
                                    }));
                                  }}
                                  className="w-20 px-2 py-1 border border-slate-200 rounded text-center focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                                />
                              </td>

                              <td className="py-3 px-4 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={70}
                                  step="1"
                                  value={mark.examScore}
                                  onChange={(e) => {
                                    const parsed = parseFloat(e.target.value);
                                    const val = isNaN(parsed) ? 0 : Math.min(70, Math.max(0, Math.round(parsed)));
                                    setManualMarks(prev => ({
                                      ...prev,
                                      [std.id]: { ...prev[std.id], examScore: val }
                                    }));
                                  }}
                                  className="w-20 px-2 py-1 border border-slate-200 rounded text-center focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                                />
                              </td>

                              <td className="py-4 px-6 text-center font-bold text-slate-900">{live.total}</td>
                              
                              <td className="py-4 px-6 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${
                                  live.grade === 'A' ? 'bg-green-50 text-green-700' :
                                  live.grade === 'B' ? 'bg-blue-50 text-blue-700' :
                                  live.grade === 'C' ? 'bg-yellow-50 text-yellow-700' :
                                  live.grade === 'P' ? 'bg-orange-50 text-orange-700' :
                                  'bg-red-50 text-red-700'
                                }`}>
                                  {live.grade}
                                </span>
                              </td>

                              <td className="py-4 px-6 font-medium text-slate-500">{live.remark}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REVIEW SCORES */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              {/* Filter controls */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-semibold">Subject:</span>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 bg-white"
                  >
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-semibold">Class:</span>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 bg-white"
                  >
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-semibold">Term:</span>
                  <select
                    value={selectedTermId}
                    onChange={(e) => setSelectedTermId(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 bg-white"
                  >
                    {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Grades Table */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto text-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase border-b border-slate-150">
                        <th className="py-3 px-6">Student ID</th>
                        <th className="py-3 px-6">Student Name</th>
                        <th className="py-3 px-6 text-center">CA Score (30)</th>
                        <th className="py-3 px-6 text-center">Exam Score (70)</th>
                        <th className="py-3 px-6 text-center">Total Score</th>
                        <th className="py-3 px-6 text-center">Grade</th>
                        <th className="py-3 px-6">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredResults.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 px-6 text-center text-slate-400">
                            No marks uploaded for this selection. Use **Marksheet Syncer** to synchronize spreadsheet rows or **Manual Entry** to type them in.
                          </td>
                        </tr>
                      ) : (
                        filteredResults.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-4 px-6 font-bold text-slate-900">{row.student_id}</td>
                            <td className="py-4 px-6 font-semibold text-slate-800">{row.students?.full_name}</td>
                            <td className="py-4 px-6 text-center">{row.ca_score.toFixed(0)}</td>
                            <td className="py-4 px-6 text-center">{row.exam_score.toFixed(0)}</td>
                            <td className="py-4 px-6 text-center font-bold text-slate-900">{row.total_score.toFixed(0)}</td>
                            <td className="py-4 px-6 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${
                                row.grade === 'A' ? 'bg-green-50 text-green-700' :
                                row.grade === 'B' ? 'bg-blue-50 text-blue-700' :
                                row.grade === 'C' ? 'bg-yellow-50 text-yellow-700' :
                                row.grade === 'P' ? 'bg-orange-50 text-orange-700' :
                                'bg-red-50 text-red-700'
                              }`}>
                                {row.grade}
                              </span>
                            </td>
                            <td className="py-4 px-6 font-medium text-slate-500">{row.remark}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SYNC LOGS */}
          {activeTab === 'logs' && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto text-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase border-b border-slate-150">
                      <th className="py-3 px-6">Subject</th>
                      <th className="py-3 px-6">Class</th>
                      <th className="py-3 px-6 text-center">Synced Count</th>
                      <th className="py-3 px-6">Status</th>
                      <th className="py-3 px-6">Sync Time</th>
                      <th className="py-3 px-6">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {syncLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 px-6 text-center text-slate-400">
                          No sync operations recorded.
                        </td>
                      </tr>
                    ) : (
                      syncLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-4 px-6 font-bold text-slate-800">{log.subjects?.name}</td>
                          <td className="py-4 px-6 font-semibold">{log.classes?.name}</td>
                          <td className="py-4 px-6 text-center font-medium">{log.records_synced}</td>
                          <td className="py-4 px-6">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                              log.status === 'Success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-slate-400 text-xs">
                            {new Date(log.sync_time).toLocaleString()}
                          </td>
                          <td className="py-4 px-6 text-slate-400 text-xs max-w-xs truncate">
                            {log.error_message || 'Synchronized without errors'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: ACCOUNT SECURITY */}
          {activeTab === 'security' && (
            <div className="max-w-md mx-auto bg-white border border-slate-100 p-8 rounded-2xl shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-base">
                <Lock className="h-5 w-5 text-red-500" /> Account Security
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Update your security password for this teacher account.
              </p>
              <form onSubmit={handleTeacherChangePassword} className="space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1 font-bold">New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    value={teacherNewPassword}
                    onChange={(e) => setTeacherNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1 font-bold">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    value={teacherConfirmPassword}
                    onChange={(e) => setTeacherConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white font-medium"
                  />
                </div>

                {teacherPassError && (
                  <p className="text-xs text-red-500 font-bold">{teacherPassError}</p>
                )}
                {teacherPassSuccess && (
                  <p className="text-xs text-green-600 font-bold">{teacherPassSuccess}</p>
                )}

                <button
                  type="submit"
                  disabled={isSyncing}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition shadow disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  Update Password
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
