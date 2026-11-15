'use client';

import { useState, useEffect, useCallback } from 'react';
import { Medication, ElderlyProfile } from '@/types';
import { MedicationManager } from '@/components/medications/MedicationManager';
import { AdherenceCharts } from '@/components/adherence/AdherenceCharts';

export default function MedicationsPage() {
  const [profile, setProfile] = useState<ElderlyProfile | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);

  // Adherence chart stats
  const [stats, setStats] = useState({
    totalScheduled: 0,
    taken: 0,
    missed: 0,
    skipped: 0,
    pending: 0,
    adherencePercentage: 100,
    currentStreakDays: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authRes.ok || !authData.authenticated) return;

      const activeId = authData.user.activeProfileId;
      if (!activeId) {
        setLoading(false);
        return;
      }

      const profRes = await fetch(`/api/profiles/${activeId}`);
      const profData = await profRes.json();
      if (profRes.ok) {
        setProfile(profData.profile);
        setCanManage(profData.isOwner || profData.permissions.canManageMedications);
      }

      const medRes = await fetch(`/api/medications?profileId=${activeId}`);
      const medData = await medRes.json();
      if (medRes.ok) {
        setMedications(medData.medications || []);
      }

      const adhRes = await fetch(`/api/doses/adherence?profileId=${activeId}&days=7`);
      const adhData = await adhRes.json();
      if (adhRes.ok) {
        setStats(adhData.stats);
        setChartData(adhData.chartData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-slate-500">No active healthcare profile found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <MedicationManager
        profileId={profile._id}
        medications={medications}
        canManage={canManage}
        onRefresh={loadData}
      />

      <div className="border-t border-slate-200 pt-6">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Medication Adherence Insights</h2>
        <AdherenceCharts stats={stats} chartData={chartData} />
      </div>
    </div>
  );
}
