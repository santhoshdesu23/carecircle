import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { DoseStatus } from '@/types';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | DoseStatus;
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: Readonly<BadgeProps>) {
  const variants = {
    default: 'bg-slate-100 text-slate-800 border-slate-200',
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold',
    taken: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
    warning: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold',
    pending: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold',
    upcoming: 'bg-teal-50 text-teal-800 border-teal-200 font-medium',
    danger: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
    missed: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
    skipped: 'bg-slate-200 text-slate-700 border-slate-300 font-medium',
    info: 'bg-sky-100 text-sky-800 border-sky-200',
    outline: 'border border-slate-300 text-slate-700 bg-transparent',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
        variants[variant] || variants.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
