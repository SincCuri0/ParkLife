"use client";

import { useMemo, useState } from "react";
import { Group } from "@/lib/types";

interface LayerToggleProps {
  groups: Group[];
  visibleGroupIds: string[];
  onChange: (ids: string[]) => void;
}

export default function LayerToggle({ groups, visibleGroupIds, onChange }: LayerToggleProps) {
  const [open, setOpen] = useState(false);
  const allIds = useMemo(() => groups.map((group) => group.id), [groups]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-16 right-2 z-20">
      <button
        type="button"
        className="mb-2 rounded-full border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
        onClick={() => setOpen((value) => !value)}
      >
        Layers
      </button>
      {open ? (
        <div className="w-64 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl">
          <div className="mb-2 flex items-center gap-2 text-xs">
            <button type="button" className="rounded bg-slate-700 px-2 py-1" onClick={() => onChange(allIds)}>
              All on
            </button>
            <button type="button" className="rounded bg-slate-700 px-2 py-1" onClick={() => onChange([])}>
              All off
            </button>
          </div>
          <div className="space-y-2">
            {groups.map((group) => {
              const visible = visibleGroupIds.includes(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() =>
                    onChange(visible ? visibleGroupIds.filter((id) => id !== group.id) : [...visibleGroupIds, group.id])
                  }
                  className="flex w-full items-center justify-between rounded border border-slate-700 px-2 py-1.5 text-left text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.colour }} />
                    <span className="truncate">{group.name}</span>
                  </span>
                  <span className={visible ? "text-emerald-300" : "text-slate-400"}>{visible ? "On" : "Off"}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
