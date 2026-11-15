'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { AdherenceStats } from '@/types';
import { TrendingUp, ShieldAlert } from 'lucide-react';

interface AdherenceChartsProps {
  stats: AdherenceStats;
  chartData: Array<{
    date: string;
    taken: number;
    missed: number;
    skipped: number;
  }>;
}

export function AdherenceCharts({ stats, chartData }: Readonly<AdherenceChartsProps>) {
  return (
    <div className="space-y-6">
      {/* Disclaimer Banner (Strict Requirement: "Clearly label this as recorded adherence, not a clinical assessment") */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <p>
          <strong>Notice:</strong> This data reflects recorded medication dose logs entered by the
          individual or authorized caretakers. It is an operational adherence tracker and does not
          constitute a clinical assessment or medical diagnosis.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Adherence Rate Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800">
              Recorded Adherence Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="py-4 text-center">
              <span className="text-6xl font-black text-teal-700">
                {stats.adherencePercentage}%
              </span>
              <p className="mt-1 text-xs font-semibold text-slate-500">Past 7 Days Adherence</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-100 py-1">
                <span className="text-slate-500">Taken Doses:</span>
                <span className="font-bold text-emerald-700">{stats.taken}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1">
                <span className="text-slate-500">Missed Doses:</span>
                <span className="font-bold text-rose-700">{stats.missed}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1">
                <span className="text-slate-500">Skipped Doses:</span>
                <span className="font-bold text-amber-700">{stats.skipped}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Current Streak:</span>
                <span className="font-bold text-teal-800">{stats.currentStreakDays} days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 7-Day Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <TrendingUp className="h-4 w-4 text-teal-700" />
              Daily Dose Activity (Past 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="taken" name="Taken" fill="#0D9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="missed" name="Missed" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="skipped" name="Skipped" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
