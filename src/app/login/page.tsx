import { Suspense } from 'react';
import LoginForm from './LoginForm';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'Staff Login Portal',
  description: 'Authentication for teachers, bursars, and administrators.',
};

export default function LoginPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-semibold text-slate-500">Loading Staff Portal...</span>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
