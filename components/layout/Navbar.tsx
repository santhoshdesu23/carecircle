'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Heart, Pill, Calendar, Users, Clock, LogOut, Menu, X, Sparkles } from 'lucide-react';
import { useSeniorMode } from './SeniorModeContext';
import { Button } from '@/components/ui/Button';

interface NavbarProps {
  user?: {
    name: string;
    email: string;
    role: string;
    activeProfileId?: string;
    authorizedProfiles?: Array<{
      id: string;
      fullName: string;
      preferredName?: string;
      isOwner: boolean;
    }>;
  } | null;
}

export function Navbar({ user }: Readonly<NavbarProps>) {
  const pathname = usePathname();
  const router = useRouter();
  const { seniorMode, toggleSeniorMode } = useSeniorMode();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchingProfile, setSwitchingProfile] = useState(false);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Heart },
    { name: 'Medications', href: '/medications', icon: Pill },
    { name: 'Appointments', href: '/appointments', icon: Calendar },
    { name: 'Care Circle', href: '/care-circle', icon: Users },
    { name: 'Timeline', href: '/timeline', icon: Clock },
  ];

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      router.push('/signin');
      router.refresh();
    } catch {
      router.push('/signin');
    }
  };

  const handleProfileSwitch = async (profileId: string) => {
    setSwitchingProfile(true);
    try {
      await fetch('/api/auth/profile-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      router.refresh();
      window.location.reload();
    } finally {
      setSwitchingProfile(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href={user ? '/dashboard' : '/'} className="group flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm transition-colors group-hover:bg-teal-800">
            <Heart className="h-6 w-6 fill-white/20 text-white" />
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-slate-900 transition-colors group-hover:text-teal-700">
              CareCircle
            </span>
            <span className="hidden text-[11px] font-medium uppercase tracking-wider text-teal-800 sm:block">
              Care, Connected. Every Day.
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        {user && (
          <nav className="hidden items-center gap-1.5 rounded-xl border border-slate-200/60 bg-slate-50/80 p-1.5 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                    isActive
                      ? 'border border-slate-200/60 bg-white text-teal-700 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100/60 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right Section: Profile selector, Senior mode, User / Auth buttons */}
        <div className="hidden items-center gap-3 lg:flex">
          {/* Senior Mode Toggle Button */}
          <button
            onClick={toggleSeniorMode}
            title={
              seniorMode
                ? 'Switch to Standard Mode'
                : 'Switch to Senior Mode (Large Text & Buttons)'
            }
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
              seniorMode
                ? 'border-amber-300 bg-amber-100 text-amber-900 ring-2 ring-amber-400/30'
                : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Senior Mode: {seniorMode ? 'ON' : 'OFF'}</span>
          </button>

          {user ? (
            <div className="flex items-center gap-3 border-l border-slate-200 pl-2">
              {/* Profile Selector if multiple profiles */}
              {(user.authorizedProfiles?.length ?? 0) > 1 && (
                <div className="relative">
                  <select
                    value={user.activeProfileId}
                    onChange={(e) => handleProfileSwitch(e.target.value)}
                    disabled={switchingProfile}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    {user.authorizedProfiles?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.preferredName || p.fullName} {p.isOwner ? '(Owner)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="text-right">
                <p className="text-xs font-bold text-slate-900">{user.name}</p>
                <p className="text-[11px] capitalize text-slate-500">{user.role}</p>
              </div>

              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link href="/signin">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu trigger */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={toggleSeniorMode}
            className={`rounded-lg border p-2 text-xs font-bold ${
              seniorMode
                ? 'border-amber-300 bg-amber-100 text-amber-900'
                : 'border-slate-200 bg-slate-100 text-slate-700'
            }`}
            aria-label="Toggle Senior Mode"
          >
            Senior Mode
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="space-y-3 border-b border-slate-200 bg-white px-4 pb-6 pt-2 lg:hidden">
          {user && (
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-base font-semibold ${
                      isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="border-t border-slate-100 pt-3">
            {user ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Link href="/signin" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Get Started</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
