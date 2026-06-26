'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { recordPayment, upsertFeeCategories } from '@/app/actions/school';
import {
  CreditCard,
  History,
  FileText,
  LogOut,
  ChevronRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Download,
  Plus,
  Percent,
  Settings,
  Lock
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { activeSchoolConfig } from '@/config/whiteLabel.config';

const CATEGORIES = [
  'Tuition Lecture Fee',
  'Uniforms Levy',
  'Books & Materials',
  'Assessments & Exams',
  'Other Admin Charges'
];

export default function BursarDashboardClient({
  students,
  feeCategories,
  initialPayments,
  classes
}: {
  students: any[];
  feeCategories: any[];
  initialPayments: any[];
  classes: any[];
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'record' | 'ledger' | 'configure' | 'security'>('overview');
  const [payments, setPayments] = useState<any[]>(initialPayments);
  
  // Form States
  const [payStudentId, setPayStudentId] = useState(students[0]?.id || '');
  const [payCategory, setPayCategory] = useState('');
  const [payAmount, setPayAmount] = useState('');

  // States for actions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<any>(null);

  const [bursarNewPassword, setBursarNewPassword] = useState('');
  const [bursarConfirmPassword, setBursarConfirmPassword] = useState('');
  const [bursarPassError, setBursarPassError] = useState<string | null>(null);
  const [bursarPassSuccess, setBursarPassSuccess] = useState<string | null>(null);

  const handleBursarChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBursarPassError(null);
    setBursarPassSuccess(null);

    if (bursarNewPassword.length < 6) {
      setBursarPassError('Password must be at least 6 characters long.');
      return;
    }

    if (bursarNewPassword !== bursarConfirmPassword) {
      setBursarPassError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: bursarNewPassword });
      if (error) throw error;
      setBursarPassSuccess('Password updated successfully!');
      setBursarNewPassword('');
      setBursarConfirmPassword('');
    } catch (err: any) {
      setBursarPassError(err.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fee Grid configuration state matrix
  const [feeMatrix, setFeeMatrix] = useState<Record<string, Record<string, number>>>(() => {
    const matrix: Record<string, Record<string, number>> = {};
    classes.forEach((c) => {
      matrix[c.id] = {};
      CATEGORIES.forEach((cat) => {
        const matching = feeCategories.find((fc) => fc.class_id === c.id && fc.name === cat);
        matrix[c.id][cat] = matching ? matching.default_amount : 0;
      });
    });
    return matrix;
  });

  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Dynamically filter categories based on the selected student's class
  const currentStudent = students.find((s) => s.id === payStudentId);
  const filteredCategories = currentStudent
    ? feeCategories.filter((f) => f.class_id === currentStudent.class_id)
    : [];

  useEffect(() => {
    // Set default category when student changes
    if (filteredCategories.length > 0) {
      setPayCategory(filteredCategories[0].name);
    } else {
      setPayCategory('');
    }
  }, [payStudentId]);

  // Aggregate Calculations
  const totalReceived = payments.reduce((acc, p) => acc + p.amount_paid, 0);
  
  // Total expected fees: multiply student count by class fee category amounts
  let totalExpected = 0;
  students.forEach((std) => {
    const classFees = feeCategories.filter((f) => f.class_id === std.class_id);
    classFees.forEach((fee) => {
      totalExpected += fee.default_amount;
    });
  });

  const outstandingBalance = Math.max(0, totalExpected - totalReceived);
  const collectionRate = totalExpected > 0 ? ((totalReceived / totalExpected) * 100).toFixed(1) : '0.0';

  // Chart data formatting
  const chartData = [
    { name: 'Fees Received', value: totalReceived, color: '#0284c7' }, // Blue
    { name: 'Outstanding Balance', value: outstandingBalance, color: '#ec4899' } // Pink
  ];

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setPaymentSuccess(null);

    const amountNum = parseFloat(payAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg('Please enter a valid payment amount.');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await recordPayment({
        studentId: payStudentId,
        category: payCategory,
        amountPaid: amountNum
      });

      if (result.success && result.payment) {
        setPaymentSuccess(result.payment);
        setPayAmount('');
        
        // Refresh local payment ledger
        const { data: newPayments } = await supabase
          .from('payments')
          .select('*, students(full_name, class_id, classes(name)), users(full_name)')
          .order('payment_date', { ascending: false });
        if (newPayments) setPayments(newPayments);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error recording student payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveFeeMatrix = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const feesList: { classId: string; name: string; amount: number }[] = [];
      Object.entries(feeMatrix).forEach(([classId, cats]) => {
        Object.entries(cats).forEach(([name, amount]) => {
          feesList.push({ classId, name, amount });
        });
      });

      const res = await upsertFeeCategories(feesList);
      if (res.success) {
        alert('Institutional fee configuration matrix saved successfully.');
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save fee configurations.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <h2 className="font-extrabold text-sm text-white tracking-tight leading-tight">Bursar Hub</h2>
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
              <CreditCard className="h-4.5 w-4.5" /> Finance Overview
            </button>
            <button
              onClick={() => setActiveTab('record')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'record' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plus className="h-4.5 w-4.5" /> Record Payment
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'ledger' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="h-4.5 w-4.5" /> Billing Ledger
            </button>
            <button
              onClick={() => setActiveTab('configure')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === 'configure' ? 'bg-primary text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="h-4.5 w-4.5" /> Configure Fees
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

        {/* User Sign-out */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800/80">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
          >
            <LogOut className="h-4.5 w-4.5" /> End Bursar Session
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-grow flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-slate-100 px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-slate-800">
            {activeTab === 'overview'
              ? 'Bursary Overview'
              : activeTab === 'record'
              ? 'Log Student Payment'
              : activeTab === 'ledger'
              ? 'Payments Transactions Ledger'
              : activeTab === 'security'
              ? 'Account Security Settings'
              : 'Configure Fee Categories'}
          </h2>
          <div className="text-xs text-slate-400 font-semibold">
            Institutional Deployment: <span className="text-secondary">{activeSchoolConfig.name}</span>
          </div>
        </header>

        <div className="p-8 max-w-6xl w-full mx-auto">
          {/* TAB 1: OVERVIEW & CHART */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Aggregates row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-1">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Total Expected</span>
                  <p className="text-2xl font-black text-slate-800">N{totalExpected.toLocaleString()}</p>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-1">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Total Received</span>
                  <p className="text-2xl font-black text-slate-800 text-secondary">N{totalReceived.toLocaleString()}</p>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-1">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Outstanding Balance</span>
                  <p className="text-2xl font-black text-slate-800 text-primary">N{outstandingBalance.toLocaleString()}</p>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-1">
                  <span className="text-xs text-slate-400 uppercase font-semibold flex items-center gap-1">
                    Collection Rate <Percent className="h-3 w-3 text-slate-400" />
                  </span>
                  <p className="text-2xl font-black text-slate-800 text-green-600">{collectionRate}%</p>
                </div>
              </div>

              {/* Chart section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm">Collection Distribution Visualization</h3>
                  <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `N${Number(value).toLocaleString()}`} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Short guidelines */}
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex gap-4 text-slate-700 h-fit">
                  <HelpCircle className="h-6 w-6 text-secondary shrink-0" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-blue-900 text-sm">Bursar Ledger Guidelines</h4>
                    <p className="text-xs leading-relaxed text-blue-800">
                      Expectation bounds are derived from **Fee Categories** mapping. Tuition and ICT categories should be configured per scholastic class. When recording payments, balances are computed incrementally relative to total expectation limits.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RECORD PAYMENT */}
          {activeTab === 'record' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form card */}
              <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4 h-fit">
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="h-5 w-5 text-primary" /> Log Payment
                </h3>
                <form onSubmit={handlePaymentSubmit} className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Select Student</label>
                    <select
                      value={payStudentId}
                      onChange={(e) => setPayStudentId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white animate-fade-in"
                    >
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.classes?.name || 'N/A'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Billing Category</label>
                    {filteredCategories.length === 0 ? (
                      <div className="text-xs text-red-500 font-medium p-2 bg-red-50 border border-red-100 rounded-lg">
                        No active fee categories configured for this student's class!
                      </div>
                    ) : (
                      <select
                        value={payCategory}
                        onChange={(e) => setPayCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none bg-white"
                      >
                        {filteredCategories.map(f => (
                          <option key={f.id} value={f.name}>
                            {f.name} (Expected: N{f.default_amount.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Amount Paid (NGN)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 10000"
                      min={100}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none"
                    />
                  </div>

                  {errorMsg && (
                    <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 flex gap-2 items-start text-xs font-medium">
                      <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || filteredCategories.length === 0}
                    className="w-full py-3 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-xl transition shadow disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4.5 w-4.5 animate-spin" /> Logging...
                      </>
                    ) : (
                      <>
                        Record Payment
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Receipt confirmation area */}
              <div className="lg:col-span-2 space-y-6">
                {paymentSuccess ? (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-6 space-y-4 animate-fade-in">
                    <div className="flex gap-3">
                      <CheckCircle className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-green-800 font-bold text-lg">Transaction Recorded</h3>
                        <p className="text-green-700 text-sm mt-0.5">
                          Payment has been logged in Supabase. Balance parameter calculated.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-green-150 grid grid-cols-2 gap-y-2 text-xs text-slate-700">
                      <span className="text-slate-400">Receipt Code:</span>
                      <span className="font-mono font-bold text-slate-900">{paymentSuccess.receipt_number}</span>
                      <span className="text-slate-400">Category:</span>
                      <span className="font-semibold">{paymentSuccess.category}</span>
                      <span className="text-slate-400">Amount Logged:</span>
                      <span className="font-bold text-green-600">N{paymentSuccess.amount_paid.toLocaleString()}</span>
                      <span className="text-slate-400">Remaining Balance:</span>
                      <span className="font-bold text-primary">N{paymentSuccess.balance.toLocaleString()}</span>
                    </div>

                    <a
                      href={`/api/public/pdf-receipt?paymentId=${paymentSuccess.id}`}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition shadow shadow-pink-100 cursor-pointer"
                    >
                      <Download className="h-4 w-4" /> Download Transaction PDF Receipt
                    </a>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center text-slate-400 text-sm">
                    No active transaction. Log a student payment to print a receipt.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TRANSACTION LEDGER */}
          {activeTab === 'ledger' && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto text-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase border-b border-slate-150">
                      <th className="py-3 px-6">Receipt Code</th>
                      <th className="py-3 px-6">Student Name</th>
                      <th className="py-3 px-6">Class</th>
                      <th className="py-3 px-6">Category</th>
                      <th className="py-3 px-6 text-right">Expected</th>
                      <th className="py-3 px-6 text-right">Paid</th>
                      <th className="py-3 px-6 text-right">Remaining Balance</th>
                      <th className="py-3 px-6 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 px-6 text-center text-slate-400">
                          No billing transactions logged.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-4 px-6 font-mono font-bold text-slate-800 text-xs">{p.receipt_number}</td>
                          <td className="py-4 px-6 font-semibold text-slate-800">{p.students?.full_name || p.student_id}</td>
                          <td className="py-4 px-6">
                            <span className="px-2 py-0.5 bg-blue-50 text-secondary text-[10px] font-bold rounded">
                              {p.students?.classes?.name || 'N/A'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-xs font-medium text-slate-500">{p.category}</td>
                          <td className="py-4 px-6 text-right">N{p.total_expected.toLocaleString()}</td>
                          <td className="py-4 px-6 text-right font-bold text-green-600">N{p.amount_paid.toLocaleString()}</td>
                          <td className="py-4 px-6 text-right font-bold text-primary">N{p.balance.toLocaleString()}</td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center">
                              <a
                                href={`/api/public/pdf-receipt?paymentId=${p.id}`}
                                className="p-1.5 bg-slate-100 hover:bg-primary hover:text-white rounded-lg text-slate-400 transition"
                                title="Download PDF slip"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: CONFIGURE FEES GRID MATRIX */}
          {activeTab === 'configure' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-150 p-6 rounded-3xl shadow-lg border-slate-100 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Institutional Fee Structure Matrix</h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      Configure standard bills for student grade levels. Saves directly to public.fee_categories.
                    </p>
                  </div>
                  <button
                    onClick={handleSaveFeeMatrix}
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-secondary hover:bg-secondary-hover text-white text-xs font-bold rounded-xl transition shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving Grid Configs...
                      </>
                    ) : (
                      'Save Grid Configurations'
                    )}
                  </button>
                </div>

                {errorMsg && activeTab === 'configure' && (
                  <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 flex gap-2 items-start text-xs font-medium">
                    <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="overflow-x-auto border border-slate-150 rounded-2xl bg-slate-50/50">
                  <table className="w-full text-left border-collapse text-[10px] md:text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 font-extrabold">
                        <th className="py-4 px-6 text-slate-800 font-black tracking-wider text-left">Class/Grade Level</th>
                        <th className="py-4 px-6 text-slate-800 font-black tracking-wider text-center">Tuition Lecture Fee</th>
                        <th className="py-4 px-6 text-slate-800 font-black tracking-wider text-center">Uniforms Levy</th>
                        <th className="py-4 px-6 text-slate-800 font-black tracking-wider text-center">Books & Materials</th>
                        <th className="py-4 px-6 text-slate-800 font-black tracking-wider text-center">Assessments & Exams</th>
                        <th className="py-4 px-6 text-slate-800 font-black tracking-wider text-center">Other Admin Charges</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {classes.map((cls) => (
                        <tr key={cls.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-4 px-6 font-black text-slate-900 text-sm tracking-wide">{cls.name}</td>
                          {CATEGORIES.map((cat) => (
                            <td key={cat} className="py-3 px-4 text-center">
                              <input
                                type="number"
                                min={0}
                                value={feeMatrix[cls.id]?.[cat] ?? 0}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setFeeMatrix((prev) => ({
                                    ...prev,
                                    [cls.id]: {
                                      ...prev[cls.id],
                                      [cat]: val
                                    }
                                  }));
                                }}
                                className="w-28 px-3 py-1.5 border border-slate-250 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center font-bold bg-white shadow-sm transition"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                Update your security password for this bursar account.
              </p>
              <form onSubmit={handleBursarChangePassword} className="space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1 font-bold">New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    value={bursarNewPassword}
                    onChange={(e) => setBursarNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1 font-bold">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    value={bursarConfirmPassword}
                    onChange={(e) => setBursarConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary bg-white font-medium"
                  />
                </div>

                {bursarPassError && (
                  <p className="text-xs text-red-500 font-bold">{bursarPassError}</p>
                )}
                {bursarPassSuccess && (
                  <p className="text-xs text-green-600 font-bold">{bursarPassSuccess}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
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
