import React from 'react';
import { Activity, Server, Zap, Database } from 'lucide-react';

export default function GlobalSystemMetrics() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden p-5">
      <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5 text-emerald-500" />
        Системные Метрики
      </h3>

      <div className="space-y-6">
        <div>
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span className="flex items-center gap-2"><Server className="w-4 h-4" /> CPU Load (Nodes)</span>
            <span>24%</span>
          </div>
          <div className="w-full bg-black/40 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '24%' }}></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span className="flex items-center gap-2"><Database className="w-4 h-4" /> Firestore Reads / min</span>
            <span>12,450 / 50k</span>
          </div>
          <div className="w-full bg-black/40 rounded-full h-2">
            <div className="bg-[#9F7AEA] h-2 rounded-full" style={{ width: '35%' }}></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Functions Invocations</span>
            <span>890 / hr</span>
          </div>
          <div className="w-full bg-black/40 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '15%' }}></div>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-black/20 rounded-xl border border-white/5">
        <h4 className="text-sm font-bold text-white mb-2">Live Logs</h4>
        <div className="font-mono text-[10px] text-slate-400 space-y-1">
          <div className="text-emerald-500">[2026-08-23 04:12:01] SYS: Routing table updated</div>
          <div>[2026-08-23 04:11:45] FIRE: Indexed 120 documents</div>
          <div>[2026-08-23 04:10:22] RTC: 4 active mesh sessions</div>
          <div className="text-orange-400">[2026-08-23 04:09:15] WARN: High latency on EU-west</div>
        </div>
      </div>
    </div>
  );
}
