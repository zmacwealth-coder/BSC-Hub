import { createClient } from '@/utils/supabase/server';
import ResultCheckerClient from './ResultCheckerClient';
import { activeSchoolConfig } from '@/config/whiteLabel.config';

export const metadata = {
  title: 'Public Result Checker',
  description: 'Check student term results using secure access tokens.',
};

export default async function ResultCheckerPage() {
  const supabase = await createClient();

  // Fetch terms and sessions to populate the dropdown selects
  const { data: terms } = await supabase
    .from('terms')
    .select('id, name, is_active')
    .order('name', { ascending: true });

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, name, is_active')
    .order('name', { ascending: false });

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50">
      {/* Dynamic Header */}
      <header className="bg-gradient-to-r from-secondary to-primary text-white py-8 px-4 text-center shadow-md">
        <h1 className="text-3xl font-extrabold tracking-tight">{activeSchoolConfig.name}</h1>
        <p className="text-sm mt-2 opacity-90">{activeSchoolConfig.motto}</p>
      </header>

      {/* Main Form & Content Area */}
      <main className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full">
          <ResultCheckerClient 
            terms={terms || []} 
            sessions={sessions || []} 
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 text-center text-xs border-t border-slate-800">
        <p>© {new Date().getFullYear()} {activeSchoolConfig.name}. All rights reserved.</p>
        <p className="mt-1 text-slate-600">Powered by Unified School Hub</p>
      </footer>
    </div>
  );
}
