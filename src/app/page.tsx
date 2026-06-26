import Link from 'next/link';
import { activeSchoolConfig } from '@/config/whiteLabel.config';
import { ShieldCheck, BookOpen, CreditCard, ChevronRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800">
      {/* Dynamic Header / Navigation */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-50 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full rounded-b-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-gradient-to-tr from-secondary to-primary rounded-xl flex items-center justify-center font-bold text-white shadow-md">
            BSC
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900">
            {activeSchoolConfig.name.split(' ').slice(0, 2).join(' ')}
            <span className="text-primary"> {activeSchoolConfig.name.split(' ').slice(2).join(' ')}</span>
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/result-checker"
            className="text-sm font-semibold text-slate-600 hover:text-primary transition"
          >
            Result Checker
          </Link>
          <Link
            href="/login"
            className="px-5 py-2 bg-secondary hover:bg-secondary-hover text-white text-sm font-bold rounded-xl transition shadow"
          >
            Staff Login
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-grow">
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-24 text-center space-y-8">
          <div className="inline-block px-4 py-1.5 bg-pink-50 border border-pink-100 text-primary text-xs font-bold rounded-full uppercase tracking-wider animate-pulse">
            Welcome to Bright Success College
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-none max-w-4xl mx-auto">
            Providing Excellence in <span className="text-secondary">Knowledge</span> and <span className="text-primary">Character</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto font-medium">
            At {activeSchoolConfig.name}, we build leaders for tomorrow through advanced scholastic tutoring and character alignment.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/result-checker"
              className="px-8 py-4 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-2xl transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl cursor-pointer"
            >
              Check Student Results <ChevronRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-2xl border border-slate-200 transition flex items-center justify-center gap-2 shadow-sm hover:shadow"
            >
              Administrative Staff Portal
            </Link>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section className="bg-white border-y border-slate-100 py-20 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 space-y-4 hover:shadow-md transition duration-300">
              <div className="h-12 w-12 bg-pink-100 text-primary rounded-2xl flex items-center justify-center">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Academic Curriculums</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Our structures provide dedicated learning tracks which are tailored to the developmental needs of our students.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 space-y-4 hover:shadow-md transition duration-300">
              <div className="h-12 w-12 bg-blue-100 text-secondary rounded-2xl flex items-center justify-center">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Academic Announcement</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                📢 Academic Session's Registration is open. All new students are advised to complete enrollment online or onsite. Visit the school office or send us a mail to get started.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 space-y-4 hover:shadow-md transition duration-300">
              <div className="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                <CreditCard className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Parental Involvement</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                We believe great education is a partnership. Parents are warmly encouraged to engage with school activities, attend meetings, and stay connected with their child's academic journey. Together, we can raise exceptional children.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Info */}
      <footer className="bg-slate-900 text-white pt-16 pb-8 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-slate-800">
          <div className="space-y-4">
            <h3 className="font-bold text-lg">{activeSchoolConfig.name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{activeSchoolConfig.motto}</p>
          </div>
          <div className="space-y-3 text-sm">
            <h4 className="font-bold text-slate-300 uppercase tracking-wider text-xs">Contact Information</h4>
            <p className="text-slate-400">{activeSchoolConfig.address}</p>
            <p className="text-slate-400">Phone: {activeSchoolConfig.phone}</p>
            <p className="text-slate-400">Email: {activeSchoolConfig.email}</p>
          </div>
          <div className="space-y-3 text-sm">
            <h4 className="font-bold text-slate-300 uppercase tracking-wider text-xs">Portals</h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <Link href="/result-checker" className="hover:text-primary transition">
                  Parent Results Hub
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-primary transition">
                  Staff Administrative Portal
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} {activeSchoolConfig.name}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:underline">Privacy Policy</Link>
            <Link href="/" className="hover:underline">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
