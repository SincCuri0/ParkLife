"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PIN_CATEGORY_LABELS, PIN_EXPIRY_DAYS } from "@/lib/constants";
import { Group, Pin, PinCategory } from "@/lib/types";
import PinCategoryPicker from "./PinCategoryPicker";

interface PlacePinModalProps {
  latitude: number;
  longitude: number;
  sessionId?: string;
  joinedGroups?: Group[];
  defaultGroupId?: string;
  currentUserId?: string;
  onClose: () => void;
  onSuccess: (pin: Pin) => void;
}

function calculateExpiry(category: PinCategory, eventDate?: string): Date {
  if (category === "event" && eventDate) {
    return new Date(new Date(eventDate).getTime() + 24 * 60 * 60 * 1000);
  }
  const days = PIN_EXPIRY_DAYS[category];
  if (!days) return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function requestPushPermission() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.register("/sw.js");
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return;
  const convertedVapidKey = Uint8Array.from(
    atob(vapidKey.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(vapidKey.length / 4) * 4, "=")),
    (char) => char.charCodeAt(0),
  );

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey,
  });

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
  });
}

export default function PlacePinModal({
  latitude,
  longitude,
  sessionId,
  joinedGroups = [],
  defaultGroupId,
  currentUserId,
  onClose,
  onSuccess,
}: PlacePinModalProps) {
  const canAuthenticatedPost = Boolean(currentUserId);
  const hasGroupTargets = joinedGroups.length > 0;
  const canSessionPost = Boolean(sessionId);
  const [postScope, setPostScope] = useState<"group" | "public">(hasGroupTargets ? "group" : "public");
  const canUseGroupScope = canAuthenticatedPost && hasGroupTargets;
  const isGroupPost = canUseGroupScope && postScope === "group";
  const [step, setStep] = useState(canUseGroupScope ? 2 : 3);
  const [authorName, setAuthorName] = useState("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(
    defaultGroupId && joinedGroups.some((group) => group.id === defaultGroupId)
      ? defaultGroupId
      : joinedGroups[0]?.id || "",
  );
  const [category, setCategory] = useState<PinCategory | null>("announcement");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("display_name");
    if (stored) {
      queueMicrotask(() => setAuthorName(stored));
    }
  }, []);

  useEffect(() => {
    if (!defaultGroupId) return;
    if (!joinedGroups.some((group) => group.id === defaultGroupId)) return;
    setSelectedGroupId(defaultGroupId);
  }, [defaultGroupId, joinedGroups]);

  const expiryPreview = useMemo(() => {
    if (!isGroupPost || !category) return null;
    return calculateExpiry(category, eventDate).toLocaleString();
  }, [isGroupPost, category, eventDate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!isGroupPost && !canAuthenticatedPost && !canSessionPost) {
      setError("No active session for anonymous posting.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isGroupPost
            ? {
                author_name: authorName || "Member",
                description,
                title,
                latitude,
                longitude,
                group_id: selectedGroupId,
                category,
                event_date: category === "event" ? eventDate || null : null,
              }
            : canAuthenticatedPost
            ? {
                author_name: authorName || "Member",
                description,
                latitude,
                longitude,
              }
            : {
                author_name: authorName || "Guest",
                description,
                latitude,
                longitude,
                session_id: sessionId,
              },
        ),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not submit pin");
        return;
      }

      window.localStorage.setItem("display_name", authorName || "Guest");
      onSuccess(data as Pin);
      if (!window.localStorage.getItem("push_prompted")) {
        window.localStorage.setItem("push_prompted", "1");
        void requestPushPermission();
      }
      onClose();
    } catch {
      setError("Network error while creating pin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl bg-slate-900 p-4 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">Place a pin</h2>

        {canUseGroupScope && step === 2 ? (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm text-slate-300">Pin target</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPostScope("public")}
                  className={`rounded px-3 py-2 text-sm ${postScope === "public" ? "bg-blue-600 font-semibold" : "border border-slate-600"}`}
                >
                  Public
                </button>
                {canUseGroupScope ? (
                  <button
                    type="button"
                    onClick={() => setPostScope("group")}
                    className={`rounded px-3 py-2 text-sm ${postScope === "group" ? "bg-blue-600 font-semibold" : "border border-slate-600"}`}
                  >
                    Group
                  </button>
                ) : null}
              </div>
            </div>
            {isGroupPost ? (
              <>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Post to group</label>
                  <select
                    value={selectedGroupId}
                    onChange={(event) => setSelectedGroupId(event.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
                  >
                    {joinedGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Category</label>
                  <PinCategoryPicker value={category} onChange={setCategory} />
                </div>
              </>
            ) : (
              <p className="rounded border border-slate-700 bg-slate-800 p-3 text-sm text-slate-300">
                Public pins are visible on the shared map and remain attached to the location you clicked.
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded border border-slate-600 px-3 py-2">
                Cancel
              </button>
              <button type="button" className="rounded bg-blue-600 px-3 py-2 font-semibold" onClick={() => setStep(3)}>
                Next
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm text-slate-300">Name</label>
              <input
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                required
                maxLength={30}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
              />
            </div>

            {isGroupPost ? (
              <div>
                <label className="mb-2 block text-sm text-slate-300">Title</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, 100))}
                  required
                  maxLength={100}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
                />
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm text-slate-300">Description ({description.length}/280)</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, 280))}
                required={!isGroupPost}
                className="h-24 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
              />
            </div>

            {isGroupPost && category === "event" ? (
              <div>
                <label className="mb-2 block text-sm text-slate-300">Event date/time</label>
                <input
                  type="datetime-local"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
                />
              </div>
            ) : null}

            <div className="flex gap-2">
              {isGroupPost ? (
                <button type="button" onClick={() => setStep(4)} className="rounded bg-blue-600 px-3 py-2 font-semibold">
                  Review
                </button>
              ) : (
                <button type="submit" disabled={loading} className="rounded bg-blue-600 px-3 py-2 font-semibold">
                  {loading ? "Submitting..." : "Submit Pin"}
                </button>
              )}
              <button type="button" onClick={onClose} className="rounded border border-slate-600 px-3 py-2">
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {isGroupPost && step === 4 && category ? (
          <div className="space-y-3">
            <div className="rounded border border-slate-700 bg-slate-800 p-3 text-sm">
              <p className="font-semibold">{title}</p>
              <p className="text-slate-300">{PIN_CATEGORY_LABELS[category]}</p>
              <p className="text-slate-300">Expires: {expiryPreview}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="rounded border border-slate-600 px-3 py-2" onClick={() => setStep(3)}>
                Back
              </button>
              <button type="submit" disabled={loading} className="rounded bg-blue-600 px-3 py-2 font-semibold">
                {loading ? "Submitting..." : "Submit Pin"}
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      </form>
    </div>
  );
}
