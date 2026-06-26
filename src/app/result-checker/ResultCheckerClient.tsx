'use client';

import { useState } from 'react';
import { Loader2, Download, AlertTriangle, CheckCircle, Search, RefreshCw } from 'lucide-react';

interface Term {
  id: string;
  name: string;
  is_active: boolean;
}

interface Session {
  id: string;
  name: string;
  is_active: boolean;
}

interface StudentDetails {
  id: string;
  admissionNumber: string;
  fullName: string;
  gender: string;
  className: string;
  parentName: string;
}

interface SubjectScore {
  subjectName: string;
  caScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  remark: string;
}

interface UsageStats {
  currentUsage: number;
  maxUsageAllowed: number;
}

interface ResultData {
  success: boolean;
  student: StudentDetails;
  results: SubjectScore[];
  usageStats: UsageStats;
}

export default function ResultCheckerClient({
  terms,
  sessions
}: {
  terms: Term[];
  sessions: Session[];
}) {
  const [studentId, setStudentId] = useState('');
  const [tokenString, setTokenString] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [termId, setTermId] = useState(terms.find(t => t.is_active)?.id || '');
  const [sessionId, setSessionId] = useState(sessions.find(s => s.is_active)?.id || '');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<ResultData | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setResultData(null);

    if (!studentId || !tokenString || !visitorName) {
      setErrorMsg('Please fill in all required fields.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/public/check-result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          tokenString,
          visitorName,
          termId,
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify result token.');
      }

      setResultData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStudentId('');
    setTokenString('');
    setVisitorName('');
    setErrorMsg(null);
    setResultData(null);
  };

  // Math aggregates for UI display
  const totalScoresSum = resultData?.results.reduce((acc, curr) => acc + curr.totalScore, 0) || 0;
  const averageScore = resultData?.results.length ? (totalScoresSum / resultData.results.length).toFixed(2) : '0.00';

  return (
    <div className="w-full">
      {!resultData ? (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 transition-all duration-300">
          <div className="bg-primary text-white p-6 md:p-8">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Search className="h-5 w-5" /> Gated Parent Portal
            </h2>
            <p className="text-xs mt-1 text-pink-100">
              Verify security tokens issued by the bursar to view student reports.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
            {errorMsg && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 flex gap-3 text-sm items-start">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Student ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. BSC-2026-0001"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Access Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. ABC123XYZ"
                  required
                  value={tokenString}
                  onChange={(e) => setTokenString(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Parent / Guardian Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Olumide Awosika"
                required
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Scholastic Year
                </label>
                <select
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.is_active ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Scholastic Term
                </label>
                <select
                  value={termId}
                  onChange={(e) => setTermId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                >
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.is_active ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Verifying Security Token...
                </>
              ) : (
                <>
                  Verify & Retrieve Marksheet
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Success Banner */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex gap-3">
              <CheckCircle className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-green-800 font-bold text-lg">Verification Successful</h3>
                <p className="text-green-700 text-sm mt-0.5">
                  Result token matches student. Secure connection established.
                </p>
              </div>
            </div>
            <div className="bg-green-100 text-green-800 text-xs font-semibold px-4 py-2 rounded-xl">
              Usage Count: {resultData.usageStats.currentUsage} / {resultData.usageStats.maxUsageAllowed} attempts
            </div>
          </div>

          {/* Student Profile Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Student Details</h4>
              <p className="text-slate-800 text-xl font-bold">{resultData.student.fullName}</p>
              <div className="grid grid-cols-2 gap-y-2 mt-4 text-sm">
                <span className="text-slate-400">Student ID:</span>
                <span className="text-slate-700 font-semibold">{resultData.student.id}</span>
                <span className="text-slate-400">Admission No:</span>
                <span className="text-slate-700 font-semibold">{resultData.student.admissionNumber}</span>
                <span className="text-slate-400">Gender:</span>
                <span className="text-slate-700">{resultData.student.gender}</span>
              </div>
            </div>

            <div className="md:border-l md:pl-8">
              <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Academic Info</h4>
              <p className="text-slate-800 text-xl font-bold">{resultData.student.className}</p>
              <div className="grid grid-cols-2 gap-y-2 mt-4 text-sm">
                <span className="text-slate-400">Parent/Guardian:</span>
                <span className="text-slate-700 font-semibold">{resultData.student.parentName}</span>
                <span className="text-slate-400">Term Average:</span>
                <span className="text-primary font-bold text-base">{averageScore}%</span>
                <span className="text-slate-400">Total Subjects:</span>
                <span className="text-slate-700">{resultData.results.length}</span>
              </div>
            </div>
          </div>

          {/* Scores Table */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg">Scholastic Results</h3>
              <a
                href={`/api/public/pdf-result?studentId=${studentId}&tokenString=${tokenString}&termId=${termId}&sessionId=${sessionId}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow"
              >
                <Download className="h-4 w-4" /> Download Official PDF
              </a>
            </div>

            {resultData.results.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No marks uploaded for the selected term and session.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                      <th className="py-4 px-6">Subject</th>
                      <th className="py-4 px-6 text-center">CA Score (30)</th>
                      <th className="py-4 px-6 text-center">Exam Score (70)</th>
                      <th className="py-4 px-6 text-center">Total (100)</th>
                      <th className="py-4 px-6 text-center">Grade</th>
                      <th className="py-4 px-6">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                    {resultData.results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="py-4 px-6 font-semibold text-slate-900">{row.subjectName}</td>
                        <td className="py-4 px-6 text-center">{row.caScore.toFixed(0)}</td>
                        <td className="py-4 px-6 text-center">{row.examScore.toFixed(0)}</td>
                        <td className="py-4 px-6 text-center font-bold text-slate-900">{row.totalScore.toFixed(0)}</td>
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                            row.grade === 'A' ? 'bg-green-100 text-green-800' :
                            row.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                            row.grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                            row.grade === 'P' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {row.grade}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-medium text-slate-600">{row.remark}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Reset Button */}
          <div className="flex justify-center mt-6">
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow"
            >
              <RefreshCw className="h-4 w-4" /> Check Another Result
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
