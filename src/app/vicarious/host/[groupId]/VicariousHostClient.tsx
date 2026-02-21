"use client";

import LiveMap from "@/components/LiveMap";
import { Group, Pin } from "@/lib/types";
import HostControls from "@/plugins/vicarious/components/HostControls";
import { VicariousSession } from "@/plugins/vicarious/types";

interface VicariousHostClientProps {
  group: Group;
  session: VicariousSession;
  initialPins: Pin[];
}

export default function VicariousHostClient({ group, session, initialPins }: VicariousHostClientProps) {
  return (
    <main className="h-screen w-full">
      <header className="flex h-12 items-center border-b border-slate-700 bg-slate-900 px-3 text-sm">
        <span>{group.name} - Vicarious Host</span>
      </header>
      <div className="relative">
        <LiveMap pins={initialPins} groups={[group]} visibleGroupIds={[group.id]} />
        <HostControls session={session} groupId={group.id} />
      </div>
    </main>
  );
}
