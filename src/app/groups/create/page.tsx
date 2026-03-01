"use client";

import { FormEvent, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { MAP_DEFAULT_CENTER } from "@/lib/constants";

interface GeocodeFeature {
  center: [number, number];
  place_name: string;
}

const GroupCreateMap = dynamic(() => import("./GroupCreateMap"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded border border-slate-700 bg-slate-800" />,
});

export default function GroupCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [latitude, setLatitude] = useState(MAP_DEFAULT_CENTER.latitude);
  const [longitude, setLongitude] = useState(MAP_DEFAULT_CENTER.longitude);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeFeature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isVirtual, setIsVirtual] = useState(false);

  const searchLocation = async () => {
    if (!query.trim()) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&types=place,locality,neighborhood&limit=5`,
    );
    const data = await response.json();
    setSearchResults((data.features || []) as GeocodeFeature[]);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        location_label: locationLabel || query || "Local area",
        latitude: isVirtual ? null : latitude,
        longitude: isVirtual ? null : longitude,
        is_public: isPublic,
        requires_approval: !isPublic && requiresApproval,
        is_virtual: isVirtual,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not create group");
      setLoading(false);
      return;
    }
    router.push(`/groups/${data.group.id}?created=1`);
  };

  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">Create Group</h1>
      <form onSubmit={onSubmit} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        {step === 1 ? (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm">Group name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm">Description ({description.length}/280)</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, 280))}
                className="h-28 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!isPublic} onChange={(event) => setIsPublic(!event.target.checked)} />
              Private group
            </label>
            {!isPublic ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(event) => setRequiresApproval(event.target.checked)}
                />
                Require admin approval to join
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isVirtual} onChange={(event) => setIsVirtual(event.target.checked)} />
              Online / no fixed location
            </label>
            <button type="button" onClick={() => setStep(2)} className="rounded bg-blue-600 px-3 py-2 font-semibold">
              Next
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <label className="mb-2 block text-sm">Where is this group based?</label>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
                placeholder="Fitzroy"
              />
              <button type="button" onClick={() => void searchLocation()} className="rounded border border-slate-600 px-3 py-2 text-sm">
                Search
              </button>
            </div>
            {searchResults.length > 0 ? (
              <div className="max-h-36 space-y-1 overflow-y-auto rounded border border-slate-700 p-2 text-sm">
                {searchResults.map((item) => (
                  <button
                    key={`${item.place_name}-${item.center.join(",")}`}
                    type="button"
                    onClick={() => {
                      setLongitude(item.center[0]);
                      setLatitude(item.center[1]);
                      setLocationLabel(item.place_name);
                    }}
                    className="block w-full rounded px-2 py-1 text-left hover:bg-slate-800"
                  >
                    {item.place_name}
                  </button>
                ))}
              </div>
            ) : null}
            {!isVirtual ? (
              <GroupCreateMap
                latitude={latitude}
                longitude={longitude}
                onPick={(lat, lng) => {
                  setLatitude(lat);
                  setLongitude(lng);
                }}
              />
            ) : null}
            <input
              value={locationLabel}
              onChange={(event) => setLocationLabel(event.target.value)}
              placeholder={isVirtual ? "Label (e.g. Online, Global)" : "Location label"}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="rounded border border-slate-600 px-3 py-2">
                Back
              </button>
              <button type="button" onClick={() => setStep(3)} className="rounded bg-blue-600 px-3 py-2 font-semibold">
                Next
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <div className="rounded border border-slate-700 bg-slate-800 p-3">
              <p className="text-lg font-semibold">{name}</p>
              <p className="text-sm text-slate-300">{locationLabel}</p>
              <p className="mt-2 text-sm text-slate-300">{description || "No description"}</p>
            </div>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="rounded border border-slate-600 px-3 py-2">
                Back
              </button>
              <button type="submit" disabled={loading} className="rounded bg-blue-600 px-3 py-2 font-semibold">
                {loading ? "Creating..." : "Create group"}
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </main>
  );
}
