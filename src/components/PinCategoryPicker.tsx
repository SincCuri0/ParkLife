"use client";

import { PIN_CATEGORY_ICONS, PIN_CATEGORY_LABELS } from "@/lib/constants";
import { PinCategory } from "@/lib/types";

interface PinCategoryPickerProps {
  value: PinCategory | null;
  onChange: (value: PinCategory) => void;
}

const CATEGORIES: PinCategory[] = ["event", "help", "item", "announcement", "hangout"];

export default function PinCategoryPicker({ value, onChange }: PinCategoryPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {CATEGORIES.map((category) => {
        const active = value === category;
        return (
          <button
            key={category}
            type="button"
            onClick={() => onChange(category)}
            className={`rounded-lg border px-3 py-2 text-left text-sm ${active ? "border-blue-500 bg-blue-600/20" : "border-slate-700 bg-slate-800"}`}
          >
            <p>{PIN_CATEGORY_ICONS[category]} {PIN_CATEGORY_LABELS[category]}</p>
          </button>
        );
      })}
    </div>
  );
}
