import type { Metadata } from 'next';
import './globals.css';
import { SeniorModeProvider } from '@/components/layout/SeniorModeContext';

export const metadata: Metadata = {
  title: 'CareCircle — Connected Care for Loved Ones',
  description:
    'Smart, interconnected healthcare management platform designed for elderly individuals, family members, and caretakers. Care, Connected. Every Day.',
  keywords: [
    'healthcare',
    'medication management',
    'elderly care',
    'caregiver',
    'family health',
    'reminders',
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-[#FAF9F6] text-slate-900 antialiased">
        <SeniorModeProvider>{children}</SeniorModeProvider>
      </body>
    </html>
  );
}
