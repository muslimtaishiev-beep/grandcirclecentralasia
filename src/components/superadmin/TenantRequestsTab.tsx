import React, { useState, useEffect } from "react";
import { Check, X, Building, Mail, Phone, Clock } from "lucide-react";
import { auth } from "../../lib/firebase";

/**
 * Both endpoints here are behind requireFirebaseAuth + requireSuperAdmin, so
 * they need the caller's live Firebase ID token. This component used to read
 * localStorage("superadmin_token") — a key nothing in the app ever writes — so
 * it sent "Bearer " with an empty token and every request came back 401. The
 * tab silently showed no requests at all.
 */
async function authHeader(): Promise<Record<string, string>> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function TenantRequestsTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      // Ensure superadmin has auth token in headers for real implementation
      const res = await fetch("/api/superadmin/tenant-requests", {
        headers: await authHeader(),
      });
      if (!res.ok) {
        // Surface it rather than rendering an empty list, which reads as
        // "no requests" when it actually means "not authorised".
        setError(res.status === 401 || res.status === 403
          ? "Нет прав суперадминистратора — войдите заново."
          : `Не удалось загрузить заявки (${res.status})`);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
        setError(null);
      } else {
        setError(data.error || "Не удалось загрузить заявки");
      }
    } catch (e) {
      console.error("Failed to fetch requests", e);
      setError("Ошибка сети при загрузке заявок");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;
    
    setProcessingId(id);
    try {
      const res = await fetch(`/api/superadmin/tenant-requests/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader()),
        },
        body: JSON.stringify({ action, rejectReason: action === "reject" ? "Rejected by SuperAdmin" : undefined })
      });
      const data = await res.json();
      if (data.success) {
        // Optimistically update
        setRequests(requests.map(req => req.id === id ? { ...req, status: action === "approve" ? "approved" : "rejected" } : req));
      } else {
        alert(data.error || "Action failed");
      }
    } catch (e) {
      console.error(e);
      alert("Network error");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-[#888888] font-mono text-xs">Loading requests...</div>;
  }

  const pendingRequests = requests.filter(r => r.status === "pending");
  const processedRequests = requests.filter(r => r.status !== "pending");

  return (
    <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 space-y-6">
      <div>
        <h3 className="text-sm font-bold text-[#ffffff]">Organization Join Requests</h3>
        <p className="text-xs text-[#888888] mt-0.5">Approve or reject new schools applying for the platform</p>
      </div>

      {error && (
        <div className="bg-[#2a1111] border border-[#5c2020] rounded-md p-3 text-xs text-[#ff9b9b] font-mono">
          ⚠ {error}
        </div>
      )}

      {pendingRequests.length === 0 ? (
        <div className="bg-[#111111] border border-[#222222] rounded-md p-8 text-center text-[#666666] font-mono text-xs">
          No pending requests
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-[#ffffff] uppercase font-mono tracking-wider">Pending ({pendingRequests.length})</h4>
          {pendingRequests.map(req => (
            <div key={req.id} className="bg-[#111111] border border-[#f5a623]/30 rounded-md p-4 flex flex-col sm:flex-row justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#ededed]" />
                  <span className="font-bold text-sm text-[#ffffff]">{req.organizationName}</span>
                </div>
                <div className="text-xs text-[#888888] flex flex-col gap-1">
                  <div className="flex items-center gap-1.5"><Mail className="w-3 h-3"/> {req.contactEmail}</div>
                  {req.contactPhone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3"/> {req.contactPhone}</div>}
                  <div className="flex items-center gap-1.5"><Clock className="w-3 h-3"/> Requested: {new Date(req.requestedAt?.seconds ? req.requestedAt.seconds * 1000 : Date.now()).toLocaleString()}</div>
                </div>
                {req.description && (
                  <div className="text-xs text-[#aaaaaa] mt-2 bg-[#222222] p-2 rounded">
                    "{req.description}"
                  </div>
                )}
              </div>
              <div className="flex items-start gap-2">
                <button
                  onClick={() => handleAction(req.id, "approve")}
                  disabled={processingId === req.id}
                  className="bg-[#112211] hover:bg-[#224422] text-[#50e3c2] border border-[#224422] px-3 py-1.5 rounded transition flex items-center gap-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve
                </button>
                <button
                  onClick={() => handleAction(req.id, "reject")}
                  disabled={processingId === req.id}
                  className="bg-[#221111] hover:bg-[#442222] text-[#ff4444] border border-[#442222] px-3 py-1.5 rounded transition flex items-center gap-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {processedRequests.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-[#222222]">
          <h4 className="text-xs font-bold text-[#ffffff] uppercase font-mono tracking-wider">Processed</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {processedRequests.map(req => (
              <div key={req.id} className="bg-[#111111] border border-[#222222] rounded-md p-4 space-y-2 opacity-70">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#ffffff]">{req.organizationName}</span>
                  <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${req.status === "approved" ? "bg-[#112211] text-[#50e3c2]" : "bg-[#221111] text-[#ff4444]"}`}>
                    {req.status}
                  </span>
                </div>
                <div className="text-[11px] text-[#888888]">{req.contactEmail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
