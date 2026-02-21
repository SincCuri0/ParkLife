"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LiveMap from "@/components/LiveMap";
import PinList from "@/components/PinList";
import PinPopup from "@/components/PinPopup";
import { createClient } from "@/lib/supabase/client";
import { Pin, PinStatus } from "@/lib/types";

interface HostMapClientProps {
  sessionId: string;
  sessionName: string;
  initialPins: Pin[];
}

export default function HostMapClient({ sessionId, sessionName, initialPins }: HostMapClientProps) {
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [shareUrl, setShareUrl] = useState("");
  const [endingSession, setEndingSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`pins:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pins",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const pin = payload.new as Pin;
          setPins((prev) => (prev.some((existing) => existing.id === pin.id) ? prev : [...prev, pin]));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pins",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const pin = payload.new as Pin;
          setPins((prev) => prev.map((existing) => (existing.id === pin.id ? pin : existing)));
          setSelectedPin((prev) => (prev?.id === pin.id ? pin : prev));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    let mounted = true;
    const refreshPins = async () => {
      const response = await fetch(`/api/sessions/${sessionId}/pins`, { cache: "no-store" });
      if (!response.ok || !mounted) {
        return;
      }
      const data = (await response.json()) as Pin[];
      if (!mounted) {
        return;
      }
      setPins(data);
      setSelectedPin((prev) => (prev ? data.find((pin) => pin.id === prev.id) || null : null));
    };

    void refreshPins();
    const interval = window.setInterval(() => {
      void refreshPins();
    }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [sessionId]);

  useEffect(() => {
    setShareUrl(`${window.location.origin}/map/${sessionId}`);
  }, [sessionId]);

  const updatePinStatus = async (pin: Pin, status: PinStatus) => {
    const method = status === "rejected" ? "DELETE" : "PATCH";
    const response = await fetch(`/api/pins/${pin.id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PATCH" ? JSON.stringify({ status }) : undefined,
    });

    if (!response.ok) {
      return;
    }

    const updated = (await response.json()) as Pin;
    setPins((prev) => prev.map((existing) => (existing.id === pin.id ? updated : existing)));
    setSelectedPin(updated);
  };

  const focusPin = (pin: Pin) => {
    setSelectedPin(pin);
    setFocusRequest((value) => value + 1);
  };

  const endSession = async () => {
    const confirmed = window.confirm("End this session? Participants will no longer be able to post new pins.");
    if (!confirmed) {
      return;
    }

    setEndingSession(true);
    const response = await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
    setEndingSession(false);

    if (!response.ok) {
      return;
    }

    window.location.href = "/host";
  };

  return (
    <main className="h-screen w-full">
      <header className="flex h-12 items-center justify-between border-b border-slate-700 bg-slate-900 px-3 text-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate">{sessionName}</span>
          <span className="rounded bg-slate-800 px-2 py-1 font-mono text-xs">ID: {sessionId}</span>
          {shareUrl ? (
            <button
              type="button"
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200"
              onClick={() => void navigator.clipboard.writeText(shareUrl)}
            >
              Copy user link
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Link href={shareUrl || `/map/${sessionId}`} className="text-emerald-300 hover:text-emerald-200">
            Open User View
          </Link>
          <button
            type="button"
            onClick={() => void endSession()}
            disabled={endingSession}
            className="text-rose-300 hover:text-rose-200 disabled:opacity-60"
          >
            {endingSession ? "Ending..." : "End Session"}
          </button>
          <Link href="/host/create" className="text-blue-300 hover:text-blue-200">
            New Session
          </Link>
        </div>
      </header>

      <div className="flex h-[calc(100vh-48px)] flex-col md:flex-row">
        <div className="relative flex-1">
          <LiveMap
            sessionId={sessionId}
            pins={pins}
            isHost
            focusPin={selectedPin}
            focusRequest={focusRequest}
            onPinSelect={focusPin}
          />
          {selectedPin ? (
            <PinPopup
              pin={selectedPin}
              isHost
              onClose={() => setSelectedPin(null)}
              onStatusChange={updatePinStatus}
            />
          ) : null}
        </div>
        <PinList pins={pins} onPinSelect={focusPin} />
      </div>
    </main>
  );
}
