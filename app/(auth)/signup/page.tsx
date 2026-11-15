'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserRole } from '@/types';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('elderly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create account.');
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F6] px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand */}
        <div className="space-y-2 text-center">
          <Link href="/" className="group inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm">
              <Heart className="h-5 w-5 fill-white/20" />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900">CareCircle</span>
          </Link>
          <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">Create your account</h2>
          <p className="text-xs text-slate-500 sm:text-sm">
            Join the connected healthcare ecosystem.
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

            {/* Role Choice */}
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-800">Your Primary Role *</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('elderly')}
                  className={`rounded-xl border p-2.5 text-center transition-all ${
                    role === 'elderly'
                      ? 'border-teal-600 bg-teal-50 font-bold text-teal-950 ring-2 ring-teal-600/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold">Elderly</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Profile Owner</p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('family')}
                  className={`rounded-xl border p-2.5 text-center transition-all ${
                    role === 'family'
                      ? 'border-teal-600 bg-teal-50 font-bold text-teal-950 ring-2 ring-teal-600/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold">Family</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Loved One</p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('caretaker')}
                  className={`rounded-xl border p-2.5 text-center transition-all ${
                    role === 'caretaker'
                      ? 'border-teal-600 bg-teal-50 font-bold text-teal-950 ring-2 ring-teal-600/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold">Caretaker</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Nurse/Aide</p>
                </button>
              </div>
            </div>

            <Input
              label="Full Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Eleanor Vance"
              required
              autoFocus
            />

            <Input
              label="Email Address *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />

            <Input
              label="Password *"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters with 1 capital and 1 number"
              helperText="Must be at least 8 characters with a number and uppercase letter"
              required
            />

            <Button
              type="submit"
              className="h-11 w-full bg-teal-700 font-bold text-white hover:bg-teal-800"
              isLoading={loading}
            >
              Create Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-slate-600">
          Already have an account?{' '}
          <Link href="/signin" className="font-bold text-teal-700 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
