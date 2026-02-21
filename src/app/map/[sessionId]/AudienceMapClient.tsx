"use client";

import { useEffect, useMemo, useState } from "react";
import LiveMap from "@/components/LiveMap";
import PinPopup from "@/components/PinPopup";
import PlacePinModal from "@/components/PlacePinModal";
import { createClient } from "@/lib/supabase/client";
import { Pin } from "@/lib/types";

interface AudienceMapClientProps {
  sessionId: string;
  sessionName: string;
  initialPins: Pin[];
}

export default function AudienceMapClient({ sessionId, sessionName, initialPins }: AudienceMapClientProps) {
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [placedCoords, setPlacedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [displayName, setDisplayName] = useState("Guest");

  useEffect(() => {
    const stored = window.localStorage.getItem("display_name");
    if (stored) {
      queueMicrotask(() => setDisplayName(stored));
    }
  }, []);

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

  const modal = useMemo(() => {
    if (!placedCoords) return null;
    return (
      <PlacePinModal
        latitude={placedCoords.lat}
        longitude={placedCoords.lng}
        sessionId={sessionId}
        onClose={() => setPlacedCoords(null)}
        onSuccess={(pin) => setPins((prev) => [...prev, pin])}
      />
    );
  }, [placedCoords, sessionId]);

  return (
    <main className="h-screen w-full">
      <header className="flex h-12 items-center justify-between border-b border-slate-700 bg-slate-900 px-3 text-sm">
        <span className="truncate">{sessionName}</span>
        <span className="text-slate-300">{displayName}</span>
      </header>

      <div className="relative">
        <LiveMap
          sessionId={sessionId}
          pins={pins}
          onPinPlace={(lat, lng) => setPlacedCoords({ lat, lng })}
          onPinSelect={(pin) => setSelectedPin(pin)}
        />
        {selectedPin ? <PinPopup pin={selectedPin} onClose={() => setSelectedPin(null)} /> : null}
        {modal}
      </div>
    </main>
  );
}
