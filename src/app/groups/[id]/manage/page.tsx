"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SessionPanel from "@/plugins/vicarious/components/SessionPanel";

interface ManageResponse {
  group: { id: string; name: string; requires_approval: boolean };
  members: Array<{ user_id: string; role: "admin" | "member"; joined_at: string; profile?: { display_name: string } }>;
  requests: Array<{ id: string; user_id: string; status: string; profile?: { display_name: string } }>;
  reports: Array<{ id: string; category: string; status: string; pin_id: string | null; comment_id: string | null; created_at: string }>;
  plugins: Array<{ group_id: string; plugin_key: string; is_installed: boolean; is_enabled: boolean; installed_at: string }>;
  plugins_available: boolean;
  plugins_error: string | null;
}

export default function GroupManagePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ManageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pluginsWorking, setPluginsWorking] = useState(false);

  useEffect(() => {
    const run = async () => {
      const response = await fetch(`/api/groups/${params.id}/manage`);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Could not load management panel");
        return;
      }
      setData(payload as ManageResponse);
    };

    void run();
  }, [params.id]);

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    void run();
  }, []);

  const handleRequest = async (requestId: string, action: "approve" | "reject") => {
    const response = await fetch(`/api/groups/${params.id}/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) return;
    setData((prev) => (prev ? { ...prev, requests: prev.requests.filter((item) => item.id !== requestId) } : prev));
  };

  const dismissReport = async (reportId: string) => {
    const response = await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    if (!response.ok) return;
    setData((prev) => (prev ? { ...prev, reports: prev.reports.filter((item) => item.id !== reportId) } : prev));
  };

  const refreshManage = async () => {
    const response = await fetch(`/api/groups/${params.id}/manage`);
    if (!response.ok) return;
    const payload = await response.json();
    setData(payload as ManageResponse);
  };

  const installPlugin = async (pluginKey: string) => {
    setPluginsWorking(true);
    await fetch(`/api/groups/${params.id}/plugins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plugin_key: pluginKey }),
    });
    await refreshManage();
    setPluginsWorking(false);
  };

  const setPluginEnabled = async (pluginKey: string, enabled: boolean) => {
    setPluginsWorking(true);
    await fetch(`/api/groups/${params.id}/plugins/${pluginKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_enabled: enabled }),
    });
    await refreshManage();
    setPluginsWorking(false);
  };

  const removePlugin = async (pluginKey: string) => {
    setPluginsWorking(true);
    await fetch(`/api/groups/${params.id}/plugins/${pluginKey}`, { method: "DELETE" });
    await refreshManage();
    setPluginsWorking(false);
  };

  if (error) {
    return <main className="mx-auto max-w-3xl p-6 text-rose-400">{error}</main>;
  }
  if (!data) {
    return <main className="mx-auto max-w-3xl p-6">Loading group management...</main>;
  }

  const vicarious = data.plugins.find((plugin) => plugin.plugin_key === "vicarious");
  const vicariousInstalled = Boolean(vicarious?.is_installed);
  const vicariousEnabled = Boolean(vicarious?.is_enabled);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Manage {data.group.name}</h1>

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-semibold">Members</h2>
        <div className="space-y-2 text-sm">
          {data.members.map((member) => (
            <div key={member.user_id} className="flex items-center justify-between rounded border border-slate-700 bg-slate-800 px-3 py-2">
              <span>{member.profile?.display_name || member.user_id}</span>
              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs uppercase">{member.role}</span>
            </div>
          ))}
        </div>
      </section>

      {data.group.requires_approval ? (
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-2 text-lg font-semibold">Join requests</h2>
          <div className="space-y-2 text-sm">
            {data.requests.length === 0 ? <p className="text-slate-400">No pending requests.</p> : null}
            {data.requests.map((request) => (
              <div key={request.id} className="flex items-center justify-between rounded border border-slate-700 bg-slate-800 px-3 py-2">
                <span>{request.profile?.display_name || request.user_id}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void handleRequest(request.id, "approve")} className="rounded bg-emerald-600 px-2 py-1 text-xs">
                    Approve
                  </button>
                  <button type="button" onClick={() => void handleRequest(request.id, "reject")} className="rounded border border-slate-500 px-2 py-1 text-xs">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-semibold">Reports</h2>
        <div className="space-y-2 text-sm">
          {data.reports.length === 0 ? <p className="text-slate-400">No open reports.</p> : null}
          {data.reports.map((report) => (
            <div key={report.id} className="flex items-center justify-between rounded border border-slate-700 bg-slate-800 px-3 py-2">
              <div>
                <p className="font-medium capitalize">{report.category}</p>
                <p className="text-xs text-slate-400">{new Date(report.created_at).toLocaleString()}</p>
              </div>
              <button type="button" onClick={() => void dismissReport(report.id)} className="rounded border border-slate-500 px-2 py-1 text-xs">
                Dismiss
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-semibold">Plugins</h2>
        {!data.plugins_available ? (
          <p className="text-sm text-amber-300">
            Plugin management unavailable: {data.plugins_error || "Run group_plugins migration first."}
          </p>
        ) : (
          <div className="rounded border border-slate-700 bg-slate-800 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-semibold">Vicarious</p>
                <p className="text-xs text-slate-400">
                  {vicariousInstalled ? (vicariousEnabled ? "Installed · Active" : "Installed · Inactive") : "Not installed"}
                </p>
              </div>
              <div className="flex gap-2">
                {!vicariousInstalled ? (
                  <button
                    type="button"
                    onClick={() => void installPlugin("vicarious")}
                    disabled={pluginsWorking}
                    className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold disabled:opacity-70"
                  >
                    Add plugin
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void setPluginEnabled("vicarious", !vicariousEnabled)}
                      disabled={pluginsWorking}
                      className="rounded border border-slate-500 px-2 py-1 text-xs disabled:opacity-70"
                    >
                      {vicariousEnabled ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removePlugin("vicarious")}
                      disabled={pluginsWorking}
                      className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-300 disabled:opacity-70"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
            {vicariousInstalled && !vicariousEnabled ? (
              <p className="text-xs text-slate-400">Activate this plugin to enable session controls.</p>
            ) : null}
          </div>
        )}
      </section>

      {currentUserId && vicariousInstalled && vicariousEnabled ? (
        <SessionPanel groupId={data.group.id} groupName={data.group.name} currentUserId={currentUserId} />
      ) : null}
    </main>
  );
}
