'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
  createStudent,
  updateStudent,
  deleteStudent,
  generateResultToken,
  updateTermResumptionDate
} from '@/app/actions/school';
import {
  Users,
  Key,
  Database,
  History,
  FileCode,
  LogOut,
  UserPlus,
  Trash2,
  Edit3,
  Calendar,
  Layers,
  MapPin,
  Lock,
  Loader2,
  CheckCircle,
  HelpCircle,
  Plus,
  RefreshCcw
} from 'lucide-react';
import { activeSchoolConfig } from '@/config/whiteLabel.config';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

export default function AdminDashboardClient({
  initialStudents,
  classes,
  sessions,
  terms,
  initialTokens,
  initialAuditLogs,
  feeCategories = [],
  payments = [],
  results = []
}: {
  initialStudents: any[];
  classes: any[];
  sessions: any[];
  terms: any[];
  initialTokens: any[];
  initialAuditLogs: any[];
  feeCategories?: any[];
  payments?: any[];
  results?: any[];
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'tokens' | 'audits' | 'settings'>('overview');
  const [students, setStudents] = useState<any[]>(initialStudents);
  const [tokens, setTokens] = useState<any[]>(initialTokens);
  const [auditLogs, setAuditLogs] = useState<any[]>(initialAuditLogs);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Interactive academic performance dropdown filters
  const [academicTermId, setAcademicTermId] = useState(terms.find(t => t.is_active)?.id || terms[0]?.id || '');
  const [academicSessionId, setAcademicSessionId] = useState(sessions.find(s => s.is_active)?.id || sessions[0]?.id || '');
  const [academicClassId, setAcademicClassId] = useState(classes[0]?.id || '');


  // Loader state for actions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  // Student Form States
  const [stdId, setStdId] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [sessionId, setSessionId] = useState(sessions.find(s => s.is_active)?.id || sessions[0]?.id || '');
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Token Form State
  const [tokenStudentId, setTokenStudentId] = useState(students[0]?.id || '');
  const [tokenMaxUsage, setTokenMaxUsage] = useState(3);
  const [generatedTokenOutput, setGeneratedTokenOutput] = useState<any>(null);
  const [resumptionDates, setResumptionDates] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    terms.forEach((t) => {
      initial[t.id] = t.next_term_begins || '';
    });
    return initial;
  });

  const handleSaveResumptionDate = async (termId: string) => {
    const val = resumptionDates[termId] || '';
    setIsSubmitting(true);
    try {
      await updateTermResumptionDate(termId, val);
      alert('Resumption date updated successfully.');
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update resumption date.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [adminPassError, setAdminPassError] = useState<string | null>(null);
  const [adminPassSuccess, setAdminPassSuccess] = useState<string | null>(null);

  const handleAdminChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPassError(null);
    setAdminPassSuccess(null);

    if (adminNewPassword.length < 6) {
      setAdminPassError('Password must be at least 6 characters long.');
      return;
    }

    if (adminNewPassword !== adminConfirmPassword) {
      setAdminPassError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: adminNewPassword });
      if (error) throw error;
      setAdminPassSuccess('Password updated successfully!');
      setAdminNewPassword('');
      setAdminConfirmPassword('');
    } catch (err: any) {
      setAdminPassError(err.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const router = useRouter();
  const supabase = createClient();

  // -------------------------------------------------------------
  // FINANCIAL ANALYTICS (Overview Tab View-Only)
  // -------------------------------------------------------------
  const totalReceived = payments.reduce((acc: number, p: any) => acc + p.amount_paid, 0);

  let totalExpected = 0;
  students.forEach((std) => {
    const classFees = feeCategories.filter((f) => f.class_id === std.class_id);
    classFees.forEach((fee) => {
      totalExpected += fee.default_amount;
    });
  });

  const outstandingBalance = Math.max(0, totalExpected - totalReceived);
  const collectionRate = totalExpected > 0 ? ((totalReceived / totalExpected) * 100).toFixed(1) : '0.0';

  const financialChartData = [
    { name: 'Generated Revenue', value: totalReceived, color: '#0284c7' }, // Blue
    { name: 'Owed Revenue', value: outstandingBalance, color: '#ec4899' }  // Pink
  ];

  // -------------------------------------------------------------
  // ACADEMIC ANALYTICS (Overview Tab View-Only Filtered)
  // -------------------------------------------------------------
  const filteredResults = results.filter((res: any) => {
    const resTermId = res.term_id;
    const resSessionId = res.session_id;
    const resClassId = res.students?.class_id;
    
    return (
      resTermId === academicTermId &&
      resSessionId === academicSessionId &&
      resClassId === academicClassId
    );
  });

  const subjectAveragesMap: Record<string, { total: number; count: number }> = {};
  filteredResults.forEach((res: any) => {
    const subjectName = res.subjects?.name || 'Unknown';
    if (!subjectAveragesMap[subjectName]) {
      subjectAveragesMap[subjectName] = { total: 0, count: 0 };
    }
    subjectAveragesMap[subjectName].total += res.total_score;
    subjectAveragesMap[subjectName].count += 1;
  });

  const academicChartData = Object.entries(subjectAveragesMap).map(([name, data]) => ({
    name,
    Average: parseFloat((data.total / data.count).toFixed(1))
  }));


  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateStudent(stdId, {
          admissionNumber,
          fullName,
          gender,
          dateOfBirth: dob,
          address,
          parentName,
          parentPhone,
          parentEmail,
          classId,
          sessionId
        });
        
        // Refresh local student state
        setStudents(prev =>
          prev.map(s =>
            s.id === stdId
              ? {
                  ...s,
                  admission_number: admissionNumber,
                  full_name: fullName,
                  gender,
                  date_of_birth: dob,
                  address,
                  parent_name: parentName,
                  parent_phone: parentPhone,
                  parent_email: parentEmail,
                  class_id: classId,
                  session_id: sessionId,
                  classes: classes.find(c => c.id === classId)
                }
              : s
          )
        );
        alert('Student record updated successfully.');
      } else {
        await createStudent({
          id: stdId,
          admissionNumber,
          fullName,
          gender,
          dateOfBirth: dob,
          address,
          parentName,
          parentPhone,
          parentEmail,
          classId,
          sessionId
        });

        // Add to local state
        setStudents(prev => [
          {
            id: stdId,
            admission_number: admissionNumber,
            full_name: fullName,
            gender,
            date_of_birth: dob,
            address,
            parent_name: parentName,
            parent_phone: parentPhone,
            parent_email: parentEmail,
            class_id: classId,
            session_id: sessionId,
            classes: classes.find(c => c.id === classId),
            created_at: new Date().toISOString()
          },
          ...prev
        ]);
        alert('Student profile created successfully.');
      }

      // Reset form
      handleResetStudentForm();
    } catch (err: any) {
      alert(err.message || 'Error saving student record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetStudentForm = () => {
    setStdId('');
    setAdmissionNumber('');
    setFullName('');
    setGender('Male');
    setDob('');
    setAddress('');
    setParentName('');
    setParentPhone('');
    setParentEmail('');
    setIsEditing(false);
    setShowForm(false);
  };

  const handleEditStudent = (student: any) => {
    setStdId(student.id);
    setAdmissionNumber(student.admission_number);
    setFullName(student.full_name);
    setGender(student.gender);
    setDob(student.date_of_birth);
    setAddress(student.address);
    setParentName(student.parent_name);
    setParentPhone(student.parent_phone);
    setParentEmail(student.parent_email);
    setClassId(student.class_id);
    setSessionId(student.session_id);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to delete this student profile? This will cascade delete their grades and tokens.')) return;
    try {
      await deleteStudent(studentId);
      setStudents(prev => prev.filter(s => s.id !== studentId));
      alert('Student record deleted.');
    } catch (err: any) {
      alert(err.message || 'Error deleting student.');
    }
  };

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setGeneratedTokenOutput(null);
    try {
      const result = await generateResultToken(tokenStudentId, tokenMaxUsage);
      if (result.success && result.token) {
        setGeneratedTokenOutput(result.token);
        // Refresh local tokens list
        setTokens(prev => [
          {
            ...result.token,
            students: { full_name: students.find(s => s.id === tokenStudentId)?.full_name || 'N/A' }
          },
          ...prev
        ]);
      }
    } catch (err: any) {
      alert(err.message || 'Error generating token.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerSeeding = async () => {
    if (!confirm('This will seed default roles, classes, subjects, fee categories, and 10 dummy students. Proceed?')) return;
    setIsSubmitting(true);
    setSeedStatus('Scaffolding database schema...');
    try {
      const res = await fetch('/api/admin/seed');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seeding failed');
      
      setSeedStatus('Seeding completed successfully!');
      alert('Seeding complete! Refreshing workspace.');
      router.refresh();
    } catch (err: any) {
      setSeedStatus(`Seeding Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter students based on search query
  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.admission_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0">
        <div>
          {/* Institution Header */}
          <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded-xl flex items-center justify-center font-bold text-white text-sm shadow">
              BSC
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white tracking-tight leading-tight">Admin Portal</h2>
              <p className="text-[10px] text-slate-500 font-medium">Bright Success College</p>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'overview' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-4.5 w-4.5" /> Overview
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'students' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="h-4.5 w-4.5" /> Students Directory
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'tokens' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="h-4.5 w-4.5" /> Access Tokens
            </button>
            <button
              onClick={() => setActiveTab('audits')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'audits' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="h-4.5 w-4.5" /> Audit Trails
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'settings' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="h-4.5 w-4.5" /> System Setup
            </button>
          </nav>
        </div>

        {/* User sign-out info */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800/80">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
          >
            <LogOut className="h-4.5 w-4.5" /> End Admin Session
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-grow flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-slate-100 px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-slate-800 capitalize">{activeTab} Manager</h2>
          <div className="text-xs text-slate-400 font-semibold">
            Institutional Deployment: <span className="text-secondary">{activeSchoolConfig.name}</span>
          </div>
        </header>

        <div className="p-8 max-w-6xl w-full mx-auto">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Widgets Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-2">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Registered Students</span>
                  <p className="text-3xl font-black text-slate-800">{students.length}</p>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-2">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Active Classes</span>
                  <p className="text-3xl font-black text-slate-800">{classes.length}</p>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-2">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Security Tokens Issued</span>
                  <p className="text-3xl font-black text-slate-800">{tokens.length}</p>
                </div>
              </div>

              {/* Analytics Visualization Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Analytics (Bursar Feed) */}
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Revenue Analytics (Bursar Feed)</h3>
                    <span className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 rounded-full">
                      Collection Rate: {collectionRate}%
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl">
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Expected</span>
                      <span className="text-sm font-extrabold text-slate-700">₦{totalExpected.toLocaleString()}</span>
                    </div>
                    <div className="text-center border-x border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Generated</span>
                      <span className="text-sm font-extrabold text-blue-600">₦{totalReceived.toLocaleString()}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Owed</span>
                      <span className="text-sm font-extrabold text-pink-600">₦{outstandingBalance.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="h-64 relative flex items-center justify-center">
                    {totalExpected === 0 ? (
                      <div className="text-xs text-slate-400 font-medium">No billing categories set up yet.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={financialChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {financialChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `₦${Number(value).toLocaleString()}`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Academic Performance Analytics */}
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Academic Performance</h3>
                    
                    {/* Interactive Dropdowns */}
                    <div className="flex gap-2">
                      <select
                        value={academicSessionId}
                        onChange={(e) => setAcademicSessionId(e.target.value)}
                        className="px-2 py-1 text-xs border border-slate-200 rounded-lg text-slate-700 focus:outline-none bg-white font-medium"
                      >
                        {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>

                      <select
                        value={academicTermId}
                        onChange={(e) => setAcademicTermId(e.target.value)}
                        className="px-2 py-1 text-xs border border-slate-200 rounded-lg text-slate-700 focus:outline-none bg-white font-medium"
                      >
                        {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>

                      <select
                        value={academicClassId}
                        onChange={(e) => setAcademicClassId(e.target.value)}
                        className="px-2 py-1 text-xs border border-slate-200 rounded-lg text-slate-700 focus:outline-none bg-white font-medium"
                      >
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="h-64 relative flex items-center justify-center">
                    {academicChartData.length === 0 ? (
                      <div className="text-xs text-slate-400 font-medium text-center space-y-1">
                        <p>No results recorded for this selection.</p>
                        <p className="text-[10px] text-slate-300">Select another session, term, or class.</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={academicChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} domain={[0, 100]} />
                          <Tooltip formatter={(value) => [`${value}%`, 'Average Score']} />
                          <Bar dataKey="Average" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={45}>
                            {academicChartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={index % 2 === 0 ? '#0284c7' : '#ec4899'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick instructions / Help */}
              <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex gap-4 text-slate-700">
                <HelpCircle className="h-6 w-6 text-secondary shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-bold text-blue-900 text-sm">Institutional Operations Guild</h4>
                  <p className="text-xs leading-relaxed text-blue-800">
                    To start checking results, first ensure the database is seeded. Next, create a student profile in the **Students Directory**, then issue an access token under **Access Tokens** to verify student term grades.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGE STUDENTS */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              {/* Search & Create controls */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <input
                  type="text"
                  placeholder="Search students by name, ID or ADM..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:max-w-md px-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition text-sm bg-white"
                />
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="px-4 py-2.5 bg-secondary hover:bg-secondary-hover text-white text-sm font-bold rounded-xl transition flex items-center gap-1.5 shadow shrink-0 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> {showForm ? 'Hide Form' : 'Register New Student'}
                </button>
              </div>

              {/* Student form overlay / section */}
              {showForm && (
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow space-y-4">
                  <h3 className="font-bold text-slate-800">{isEditing ? 'Modify Student Details' : 'Register Student Profile'}</h3>
                  <form onSubmit={handleStudentSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Student ID (Code)</label>
                      <input
                        type="text"
                        placeholder="e.g. BSC-2026-0001"
                        required
                        disabled={isEditing}
                        value={stdId}
                        onChange={(e) => setStdId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Admission Number</label>
                      <input
                        type="text"
                        placeholder="e.g. ADM-2026-01"
                        required
                        value={admissionNumber}
                        onChange={(e) => setAdmissionNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Full Student Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Bisi Awosika"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Scholastic Class</label>
                      <select
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      >
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Gender</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Date of Birth</label>
                      <input
                        type="date"
                        required
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Parent/Guardian Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Olumide Awosika"
                        required
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Parent Phone Number</label>
                      <input
                        type="text"
                        placeholder="e.g. +2348000000000"
                        required
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Parent Email Address</label>
                      <input
                        type="email"
                        placeholder="parent@gmail.com"
                        required
                        value={parentEmail}
                        onChange={(e) => setParentEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Home Address</label>
                      <input
                        type="text"
                        placeholder="Home Address"
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="md:col-span-3 flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleResetStudentForm}
                        className="px-4 py-2 border border-slate-250 rounded-lg text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition shadow disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmitting ? 'Saving record...' : isEditing ? 'Update Student Record' : 'Register Profile'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Student Directory Table */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase border-b border-slate-150">
                        <th className="py-3 px-6">ID & Admission</th>
                        <th className="py-3 px-6">Student Name</th>
                        <th className="py-3 px-6">Class</th>
                        <th className="py-3 px-6">Parent Info</th>
                        <th className="py-3 px-6 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 px-6 text-center text-slate-400">
                            No student matches the search query.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((std) => (
                          <tr key={std.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-4 px-6">
                              <span className="font-bold text-slate-900 block">{std.id}</span>
                              <span className="text-xs text-slate-400">{std.admission_number}</span>
                            </td>
                            <td className="py-4 px-6 font-semibold text-slate-800">{std.full_name}</td>
                            <td className="py-4 px-6">
                              <span className="px-2.5 py-1 bg-blue-50 text-secondary text-xs font-bold rounded-lg">
                                {std.classes?.name || 'N/A'}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="block font-medium text-slate-700">{std.parent_name}</span>
                              <span className="text-xs text-slate-400">{std.parent_email} | {std.parent_phone}</span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEditStudent(std)}
                                  className="p-1.5 text-slate-400 hover:text-secondary hover:bg-blue-50 rounded-lg transition"
                                  title="Edit details"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteStudent(std.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                  title="Delete student"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACCESS TOKENS */}
          {activeTab === 'tokens' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Token generator Card */}
              <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm h-fit space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Key className="h-5 w-5 text-primary" /> Issue Result Key
                </h3>
                <form onSubmit={handleGenerateToken} className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Target Student</label>
                    <select
                      value={tokenStudentId}
                      onChange={(e) => setTokenStudentId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                    >
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Max Usages Allowed</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={10}
                      value={tokenMaxUsage}
                      onChange={(e) => setTokenMaxUsage(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-lg transition shadow disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'Generating...' : 'Generate Secure Token'}
                  </button>
                </form>

                {generatedTokenOutput && (
                  <div className="bg-green-50 border border-green-200 p-4 rounded-xl space-y-2 text-xs">
                    <div className="flex gap-2 text-green-700">
                      <CheckCircle className="h-4.5 w-4.5 shrink-0" />
                      <span className="font-bold">Token Created Successfully</span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-green-150 text-center font-mono text-base font-black tracking-wider text-green-800 uppercase">
                      {generatedTokenOutput.token_string}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Copy this token and issue to the parent. Expire date: {new Date(generatedTokenOutput.expires_at).toLocaleDateString()}.
                    </p>
                  </div>
                )}
              </div>

              {/* Tokens list Table */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden lg:col-span-2">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm">Active Tokens Ledger</h3>
                </div>
                <div className="overflow-x-auto text-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase border-b border-slate-150">
                        <th className="py-3 px-6">Token</th>
                        <th className="py-3 px-6">Student</th>
                        <th className="py-3 px-6 text-center">Usages</th>
                        <th className="py-3 px-6">Status</th>
                        <th className="py-3 px-6">Expires</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {tokens.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 px-6 text-center text-slate-400">
                            No tokens issued yet.
                          </td>
                        </tr>
                      ) : (
                        tokens.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-4 px-6 font-mono font-bold text-primary uppercase">{t.token_string}</td>
                            <td className="py-4 px-6 font-semibold text-slate-800">{t.students?.full_name || t.student_id}</td>
                            <td className="py-4 px-6 text-center font-medium">
                              {t.usage_count} / {t.max_usage}
                            </td>
                            <td className="py-4 px-6">
                              <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                                t.status === 'Active' ? 'bg-green-50 text-green-700' :
                                t.status === 'Consumed' ? 'bg-blue-50 text-blue-700' :
                                'bg-red-50 text-red-700'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-slate-400 text-xs">
                              {new Date(t.expires_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT TRAILS */}
          {activeTab === 'audits' && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto text-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase border-b border-slate-150">
                      <th className="py-3 px-6">Action</th>
                      <th className="py-3 px-6">Operator</th>
                      <th className="py-3 px-6">Details</th>
                      <th className="py-3 px-6">IP / Platform</th>
                      <th className="py-3 px-6">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 px-6 text-center text-slate-400">
                          No audit trails logged yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-4 px-6 font-bold text-slate-800 text-xs">
                            <span className="px-2 py-0.5 bg-slate-100 rounded">{log.action}</span>
                          </td>
                          <td className="py-4 px-6 font-semibold text-slate-700">{log.users?.full_name || 'System'}</td>
                          <td className="py-4 px-6 text-xs">{log.details}</td>
                          <td className="py-4 px-6 text-slate-400 text-xs">{log.ip_address}</td>
                          <td className="py-4 px-6 text-slate-400 text-xs">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM SETUP */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Database scaffolding controls */}
              <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Database className="h-5 w-5 text-secondary" /> Database Seeding
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Use this utility to populate your database with baseline scholastic configs, roles, classes, subjects, and sample students for testing purposes.
                </p>
                <button
                  onClick={handleTriggerSeeding}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-secondary hover:bg-secondary-hover text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" /> Seed System Mock Configurations
                </button>
                {seedStatus && (
                  <div className="bg-slate-100 p-3 rounded-lg text-slate-700 text-xs font-mono">
                    {seedStatus}
                  </div>
                )}
              </div>

              {/* Displays loaded settings */}
              <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileCode className="h-5 w-5 text-primary" /> Active Configurations
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 font-semibold block mb-0.5">Active Session</span>
                    <span className="font-bold text-slate-800">{sessions.find(s => s.is_active)?.name || 'None'}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 font-semibold block mb-0.5">Active Term</span>
                    <span className="font-bold text-slate-800">{terms.find(t => t.is_active)?.name || 'None'}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2">
                    <span className="text-slate-400 font-semibold block mb-0.5">Classes configured</span>
                    <span className="font-bold text-slate-800">{classes.map(c => c.name).join(', ') || 'None'}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Term Resumption Settings</h4>
                  <div className="space-y-3">
                    {terms.map((term) => (
                      <div key={term.id} className="flex items-center justify-between gap-3 text-xs p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                        <div>
                          <span className="font-bold text-slate-700 block">{term.name}</span>
                          <span className="text-[10px] text-slate-400">{term.is_active ? 'Active Term' : 'Inactive'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="e.g. September 14, 2026"
                            value={resumptionDates[term.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setResumptionDates((prev) => ({
                                ...prev,
                                [term.id]: val
                              }));
                            }}
                            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-primary w-40 font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveResumptionDate(term.id)}
                            disabled={isSubmitting}
                            className="px-2.5 py-1.5 bg-secondary hover:bg-secondary-hover text-white text-[10px] font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Change Password Card */}
              <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock className="h-5 w-5 text-red-500" /> Account Security
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Update your security password for this administrator account.
                </p>
                <form onSubmit={handleAdminChangePassword} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1 font-bold">New Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      required
                      value={adminNewPassword}
                      onChange={(e) => setAdminNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-250 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1 font-bold">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      required
                      value={adminConfirmPassword}
                      onChange={(e) => setAdminConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-250 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white font-medium"
                    />
                  </div>

                  {adminPassError && (
                    <p className="text-[10px] text-red-500 font-bold">{adminPassError}</p>
                  )}
                  {adminPassSuccess && (
                    <p className="text-[10px] text-green-600 font-bold">{adminPassSuccess}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
