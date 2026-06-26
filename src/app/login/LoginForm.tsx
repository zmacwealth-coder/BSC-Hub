'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Lock, Mail, AlertCircle } from 'lucide-react';
import { activeSchoolConfig } from '@/config/whiteLabel.config';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');

  const supabase = createClient();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await handleRedirect(user.id);
      }
    };
    checkUser();
  }, []);

  const handleRedirect = async (userId: string) => {
    try {
      const { data: profile, error: profErr } = await supabase
        .from('users')
        .select('role_id')
        .eq('auth_user_id', userId)
        .single();

      if (profErr || !profile) {
        throw new Error('User profile database record not found.');
      }

      const { data: role, error: roleErr } = await supabase
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .single();

      if (roleErr || !role) {
        throw new Error('Role metadata not found.');
      }

      const roleName = role.name;

      if (redirectPath) {
        router.push(redirectPath);
        return;
      }

      if (roleName === 'SUPER_ADMIN') {
        router.push('/admin');
      } else if (roleName === 'TEACHER') {
        router.push('/teacher');
      } else if (roleName === 'BURSAR') {
        router.push('/bursar');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error checking user roles');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.user) {
        await handleRedirect(data.user.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate staff.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="inline-flex h-12 w-12 bg-gradient-to-tr from-secondary to-primary rounded-2xl items-center justify-center font-bold text-white shadow-md text-xl mx-auto">
          BSC
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Staff Portal Login
        </h2>
        <p className="text-sm text-slate-500 font-medium">
          Access your workspace at {activeSchoolConfig.name}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-100 rounded-3xl sm:px-10">
          <form onSubmit={handleLogin} className="space-y-6">
            {errorMsg && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 flex gap-3 text-sm items-start">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Work Email Address
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="name@school.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Security Password
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Verifying Credentials...
                </>
              ) : (
                <>
                  Authenticate Staff
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            <p>Authorized access only. All actions logged.</p>
            <p className="mt-1 font-semibold text-primary">
              Request login credentials from the School Administrator
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
