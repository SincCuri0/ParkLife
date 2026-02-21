"use client";

import { FormEvent, useState } from "react";
import { GUEST_NAME_KEY, GUEST_NAME_MAX } from "../constants";

interface GuestNameEntryProps {
  onConfirm: (name: string) => void;
}

export default function GuestNameEntry({ onConfirm }: GuestNameEntryProps) {
  const [name, setName] = useState("");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    window.localStorage.setItem(GUEST_NAME_KEY, trimmed);
    onConfirm(trimmed);
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5">
      <h2 className="text-xl font-semibold">What should we call you?</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, GUEST_NAME_MAX))}
          maxLength={GUEST_NAME_MAX}
          className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
          placeholder="Your display name"
          required
        />
        <button type="submit" className="w-full rounded bg-blue-600 px-4 py-2 font-semibold">
          Join session
        </button>
      </form>
      <p className="mt-3 text-xs text-slate-400">No account needed. Your name only appears on pins you drop.</p>
    </div>
  );
}
