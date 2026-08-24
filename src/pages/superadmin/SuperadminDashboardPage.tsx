import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldAlert, ArrowLeft, Building2, Users, DollarSign, Activity } from 'lucide-react';
import { fetchPlatformMetrics, fetchAllTenants, PlatformMetrics } from '../../services/superadminService';
import { Tenant } from '../../types/firestore';
import TenantManagementTable from './components/TenantManagementTable';
import GlobalSystemMetrics from './components/GlobalSystemMetrics';
import MaintenanceControl from './components/MaintenanceControl';

export default function SuperadminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // Only superadmin can access this
    const token = (user as any)?.accessToken; // Wait, token logic is async
    const verifySuperadmin = async () => {
      try {
        if (!user) {
          navigate('/login');
          return;
        }

        const idTokenResult = await user.getIdTokenResult();
        if (!idTokenResult.claims?.isSuperadmin) {
          throw new Error("Access Denied: Not a superadmin claim.");
        }
        
        const m = await fetchPlatformMetrics();
        const t = await fetchAllTenants();
        setMetrics(m);
        setTenants(t);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    verifySuperadmin();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#050508] text-white flex items-center justify-center font-mono">
        Authenticating Superadmin Access...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh bg-[#050508] text-white flex items-center justify-center">
        <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-xl text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#050508] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white transition mb-2">
              <ArrowLeft className="w-4 h-4" /> Назад
            </button>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-[#9F7AEA]" />
              Superadmin Center
            </h1>
            <p className="text-slate-400 mt-1">Глобальный контроль платформы Nope Labs</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 font-mono">SYS_STATUS</div>
            <div className="text-emerald-500 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ALL SYSTEMS ONLINE
            </div>
          </div>
        </div>

        {/* Top Analytics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">Platform MRR</span>
                <DollarSign className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-white">${metrics.mrr.toLocaleString()}</div>
              <div className="text-xs text-emerald-400 mt-1">ARR: ${metrics.arr.toLocaleString()}</div>
            </div>
            
            <div className="p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">Active Tenants</span>
                <Building2 className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-white">{metrics.totalTenants}</div>
              <div className="text-xs text-slate-400 mt-1 flex gap-2">
                <span>S: {metrics.planBreakdown.starter}</span>
                <span>B: {metrics.planBreakdown.business}</span>
                <span>E: {metrics.planBreakdown.enterprise}</span>
              </div>
            </div>

            <div className="p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">Active Users</span>
                <Users className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-white">{metrics.activeStudents + metrics.activeStaff}</div>
              <div className="text-xs text-slate-400 mt-1">Students & Staff cross-tenant</div>
            </div>

            <div className="p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">System Load</span>
                <Activity className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-white">42 ms</div>
              <div className="text-xs text-emerald-400 mt-1">Avg Firestore Latency</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <TenantManagementTable tenants={tenants} onUpdate={() => window.location.reload()} />
          </div>
          <div className="space-y-6">
            <MaintenanceControl />
            <GlobalSystemMetrics />
          </div>
        </div>

      </div>
    </div>
  );
}
