import Link from 'next/link';
import {
  Heart,
  Pill,
  Calendar,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  BellRing,
  Volume2,
  Lock,
  Eye,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* 1. Navbar */}
      <Navbar user={null} />

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pb-20 pt-12 md:pb-28 md:pt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50 px-4 py-1.5 text-xs font-bold text-teal-800 shadow-sm sm:text-sm">
              <Sparkles className="h-4 w-4 text-teal-600" />
              <span>Smart, Connected Elder Care Management</span>
            </div>

            <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Healthcare feels easier when care is{' '}
              <span className="text-teal-700 underline decoration-teal-300 decoration-wavy decoration-2">
                connected.
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-lg font-normal leading-relaxed text-slate-600 sm:text-xl">
              Manage medications, stay on top of appointments, and keep the entire care circle
              informed through one simple and secure platform.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="h-14 w-full bg-teal-700 px-8 text-base font-bold text-white shadow-md hover:bg-teal-800 sm:w-auto"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="#features">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 w-full px-8 text-base font-semibold sm:w-auto"
                >
                  Explore Features
                </Button>
              </a>
            </div>

            <div className="flex items-center justify-center gap-6 pt-6 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
                Dedicated Senior Mode
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
                Passcode Protected Access
              </span>
            </div>
          </div>

          {/* 3 & 4. Interactive Product Dashboard Preview */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="rounded-2xl border-4 border-slate-200/80 bg-white p-4 shadow-floating sm:p-6">
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-rose-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 font-mono text-xs text-slate-400">
                    CareCircle Connected Suite
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
                  <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
                  Live Healthcare Ecosystem
                </div>
              </div>

              {/* Mock Dashboard Preview Content */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="space-y-4 md:col-span-2">
                  <div className="rounded-xl bg-teal-700 p-5 text-white shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-teal-200">
                      Up Next For Eleanor Vance
                    </p>
                    <h3 className="mt-1 text-xl font-bold sm:text-2xl">
                      Lisinopril 10mg{' '}
                      <span className="text-sm font-normal text-teal-100">• 08:30 AM</span>
                    </h3>
                    <p className="mt-1 text-xs text-teal-100">
                      Take 1 tablet with a full glass of water after breakfast.
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-teal-900 shadow-sm">
                        ✓ I&apos;ve taken my medicine
                      </span>
                      <span className="text-xs text-teal-200">
                        Care circle will be updated instantly
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Today&apos;s Medication Regimen</span>
                      <span className="text-teal-700">2 of 3 Completed</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5">
                        <span className="font-semibold text-slate-800">
                          Lisinopril 10mg (Morning)
                        </span>
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                          Taken at 8:35 AM
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5">
                        <span className="font-semibold text-slate-800">
                          Metformin 500mg (Lunch)
                        </span>
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                          Taken at 12:40 PM
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5">
                        <span className="font-semibold text-slate-800">
                          Atorvastatin 20mg (Bedtime)
                        </span>
                        <span className="rounded bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                          Upcoming at 9:00 PM
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                    <span className="text-xs font-bold uppercase text-slate-500">
                      Upcoming Visit
                    </span>
                    <p className="text-sm font-bold text-slate-900">Dr. Sarah Jenkins</p>
                    <p className="text-xs font-medium text-teal-700">St. Jude Heart Center</p>
                    <p className="text-xs text-slate-500">Friday at 10:30 AM</p>
                    <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                      ✓ Previous ECG reports ready
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                    <span className="text-xs font-bold uppercase text-slate-500">
                      Care Circle (3)
                    </span>
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-slate-800">
                        Eleanor Vance <span className="text-slate-400">(Owner)</span>
                      </p>
                      <p className="font-semibold text-slate-800">
                        Nurse Clara <span className="text-teal-700">(Caretaker)</span>
                      </p>
                      <p className="font-semibold text-slate-800">
                        David Vance <span className="text-slate-500">(Son / Family)</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. How CareCircle Works Section */}
      <section className="border-y border-slate-200/80 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl space-y-3 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-700">
              Simple & Seamless
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              How CareCircle Works
            </h2>
            <p className="text-base text-slate-600">
              Built from the ground up for simplicity, trust, and total elderly control.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="relative space-y-4 rounded-2xl border border-slate-200/80 bg-[#FAF9F6] p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-xl font-black text-teal-800">
                1
              </div>
              <h3 className="text-xl font-bold text-slate-900">Set Up the Healthcare Profile</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Add prescription regimens, dosage times, doctor instructions, and upcoming clinic
                appointments.
              </p>
            </div>

            <div className="relative space-y-4 rounded-2xl border border-slate-200/80 bg-[#FAF9F6] p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-xl font-black text-teal-800">
                2
              </div>
              <h3 className="text-xl font-bold text-slate-900">Invite Family & Caretakers</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Generate single-use 8-digit access passcodes. Loved ones and nurses connect securely
                in seconds without shared passwords.
              </p>
            </div>

            <div className="relative space-y-4 rounded-2xl border border-slate-200/80 bg-[#FAF9F6] p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-xl font-black text-teal-800">
                3
              </div>
              <h3 className="text-xl font-bold text-slate-900">Care, Connected. Every Day.</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Track doses, receive email alerts for missed medicine, view handover notes, and
                prepare for doctor visits collaboratively.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Features and Benefits */}
      <section id="features" className="bg-[#FAF9F6] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl space-y-3 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-700">
              Comprehensive Suite
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Features Designed for Peace of Mind
            </h2>
            <p className="text-base text-slate-600">
              Everything required to safeguard elderly healthcare routines without overwhelming
              complexity.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Pill className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Medication Scheduling</h3>
              <p className="text-sm text-slate-600">
                Support for once, twice, three-times daily, or custom frequencies with dosage forms,
                doctor instructions, and pill organizer synchronization.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <BellRing className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Smart Missed-Dose Alerts</h3>
              <p className="text-sm text-slate-600">
                Automatic grace period detection dispatches transactional email alerts to authorized
                family and caretakers if a dose goes unconfirmed.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Calendar className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Doctor Appointments & Prep</h3>
              <p className="text-sm text-slate-600">
                Track clinic visits, locations, and interactive preparation checklists (bringing
                previous ECGs, test reports, and questions for the physician).
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Adherence Insights</h3>
              <p className="text-sm text-slate-600">
                Transparent visual charts tracking daily, weekly, and monthly adherence trends, dose
                completions, and consecutive day streaks.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Caregiver Handover Notes</h3>
              <p className="text-sm text-slate-600">
                Keep shift nurses, visiting caretakers, and relatives in sync with chronological
                handover observations and vital sign notes.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Passcode-Based Shared Access</h3>
              <p className="text-sm text-slate-600">
                No shared passwords. Each member uses their own account authenticated with expiring
                8-digit salted passcodes and granular roles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7 & 8. Accessibility & Dedicated Senior Mode */}
      <section className="border-y border-slate-200/80 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                <Eye className="h-3.5 w-3.5" />
                WCAG 2.2 AA Accessibility Target
              </div>

              <h2 className="text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
                Designed primarily for seniors. Not an afterthought.
              </h2>

              <p className="text-base leading-relaxed text-slate-600">
                Most health applications are cluttered with tiny icons and dense data tables.
                CareCircle features a dedicated <strong>Senior Mode</strong> that transforms the
                interface:
              </p>

              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-700" />
                  <span>
                    <strong>Large Touch Targets:</strong> Buttons and clickable elements are 52–64px
                    high for effortless tapping without accidental misclicks.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-700" />
                  <span>
                    <strong>Text-to-Speech Read Aloud:</strong> Integrated Web Speech API audio
                    assistance reads prescription directions clearly out loud.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-700" />
                  <span>
                    <strong>High-Contrast Typography:</strong> Deep navy and high-contrast badges
                    ensure readability under diverse lighting conditions.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-700" />
                  <span>
                    <strong>Elder Sovereignty:</strong> Elderly individuals remain the verified
                    owner of their healthcare record with full access management.
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border-2 border-slate-300 bg-[#FAF9F6] p-6 shadow-card sm:p-8">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                  Senior Mode Active
                </span>
                <span className="font-mono text-xs text-slate-500">Simplified Experience</span>
              </div>

              <div className="space-y-4 rounded-2xl border-2 border-teal-600 bg-white p-6 text-center">
                <p className="text-xs font-extrabold uppercase tracking-wider text-teal-800">
                  Upcoming Medication (10:00 AM)
                </p>
                <h3 className="text-2xl font-black text-slate-900 sm:text-3xl">Lisinopril 10mg</h3>
                <p className="text-base font-medium text-slate-700">
                  Take with water after breakfast.
                </p>
                <div className="pt-2">
                  <span className="inline-block w-full rounded-xl bg-teal-700 py-4 text-lg font-black text-white shadow-md">
                    ✓ I&apos;ve taken my medicine
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Volume2 className="h-4 w-4 text-teal-700" />
                <span>One tap audio reading available on all instructions</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Security & Privacy Section */}
      <section className="bg-[#FAF9F6] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl space-y-3 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-700">
              Bank-Grade Privacy
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Security Built Around Health Sovereignty
            </h2>
            <p className="text-base text-slate-600">
              Personal health data is sensitive. We enforce strict role-based access and immutable
              audit logging.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-white p-6">
              <ShieldCheck className="h-8 w-8 text-teal-700" />
              <h3 className="text-base font-bold text-slate-900">Hashed Passcodes</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Invitation codes are salted and hashed using HMAC-SHA256. Plaintext passcodes are
                never stored in the database.
              </p>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-white p-6">
              <Lock className="h-8 w-8 text-teal-700" />
              <h3 className="text-base font-bold text-slate-900">Profile-Level Authorization</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Every backend route verifies active membership and granular permissions. Hiding
                buttons in the frontend is never confused with security.
              </p>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-white p-6">
              <Clock className="h-8 w-8 text-teal-700" />
              <h3 className="text-base font-bold text-slate-900">Immutable Audit Logs</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Every dose entry, schedule modification, appointment update, and membership
                revocation is permanently recorded with actor identity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Call to Action */}
      <section className="bg-teal-800 py-20 text-center text-white">
        <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Give your loved ones the care they deserve.
          </h2>
          <p className="mx-auto max-w-xl text-base text-teal-100 sm:text-lg">
            Join hundreds of families and healthcare caretakers already collaborating on CareCircle.
          </p>
          <div className="pt-2">
            <Link href="/signup">
              <Button
                size="xl"
                className="bg-white font-extrabold text-teal-900 shadow-lg hover:bg-slate-100"
              >
                Create Free Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 11. Footer */}
      <footer className="border-t border-slate-800 bg-slate-900 py-12 text-xs text-slate-400">
        <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xl font-extrabold text-white">
                <Heart className="h-5 w-5 fill-teal-400/20 text-teal-400" />
                <span>CareCircle</span>
              </div>
              <p className="text-xs text-slate-400">Care, Connected. Every Day.</p>
            </div>

            <div className="flex flex-wrap gap-6 font-medium text-slate-300">
              <Link href="/signin" className="transition-colors hover:text-white">
                Sign In
              </Link>
              <Link href="/signup" className="transition-colors hover:text-white">
                Get Started
              </Link>
              <a href="#features" className="transition-colors hover:text-white">
                Features
              </a>
              <Link href="/dashboard" className="transition-colors hover:text-white">
                Dashboard
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-6 text-slate-500 md:flex-row">
            <p>
              &copy; {new Date().getFullYear()} CareCircle. Built for resilient, production-ready
              Vercel serverless deployment.
            </p>
            <p className="max-w-md text-center md:text-right">
              Disclaimer: CareCircle is an operational healthcare management and reminder tool. It
              does not provide medical diagnoses, treatment advice, or alter dosages.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
