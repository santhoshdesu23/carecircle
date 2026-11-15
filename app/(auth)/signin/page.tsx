'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid email or password.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Account Auto-Fill
  const fillDemoAccount = (role: 'elderly' | 'caretaker' | 'family') => {
    if (role === 'elderly') {
      setEmail('eleanor.vance@carecircle.demo');
      setPassword('CareCircle2026!');
    } else if (role === 'caretaker') {
      setEmail('nurse.clara@carecircle.demo');
      setPassword('CareCircle2026!');
    } else {
      setEmail('david.vance@carecircle.demo');
      setPassword('CareCircle2026!');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F6] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="space-y-2 text-center">
          <Link href="/" className="group inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm">
              <Heart className="h-5 w-5 fill-white/20" />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900">CareCircle</span>
          </Link>
          <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">Welcome back</h2>
          <p className="text-xs text-slate-500 sm:text-sm">
            Sign in to access your shared healthcare ecosystem.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
                {error}
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Button
              type="submit"
              className="h-11 w-full bg-teal-700 font-bold text-white hover:bg-teal-800"
              isLoading={loading}
            >
              Sign In to CareCircle
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          {/* Quick Demo Pre-Fill Buttons */}
          <div className="mt-6 space-y-2 border-t border-slate-100 pt-5">
            <p className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Quick Test Sign-In
            </p>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => fillDemoAccount('elderly')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-teal-50 hover:text-teal-800"
              >
                Elderly
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('caretaker')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-teal-50 hover:text-teal-800"
              >
                Caretaker
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('family')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-teal-50 hover:text-teal-800"
              >
                Family
              </button>
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-slate-600">
          Don&apos;t have an account yet?{' '}
          <Link href="/signup" className="font-bold text-teal-700 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
