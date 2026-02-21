"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GroupCard from "@/components/GroupCard";
import LiveMap from "@/components/LiveMap";
import NotificationItem from "@/components/NotificationItem";
import PinPopup from "@/components/PinPopup";
import PlacePinModal from "@/components/PlacePinModal";
import { createClient } from "@/lib/supabase/client";
import { Group, Notification, Pin } from "@/lib/types";
import HostControls from "@/plugins/vicarious/components/HostControls";
import { useVicariousSession } from "@/plugins/vicarious/hooks/useVicariousSession";

interface MapClientProps {
  pins: Pin[];
  groups: Group[];
  currentUserId?: string;
  adminGroupIds?: string[];
}

function AdminVicariousOverlay({ groupId }: { groupId: string }) {
  const { session } = useVicariousSession(groupId);
  if (!session) return null;
  return <HostControls session={session} groupId={groupId} />;
}

export default function MapClient({ pins: initialPins, groups, currentUserId, adminGroupIds = [] }: MapClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePanel = searchParams.get("panel");
  const focusPinId = searchParams.get("pin");

  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [allGroups, setAllGroups] = useState<Group[]>(groups);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [placedCoords, setPlacedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [visibleGroupIds, setVisibleGroupIds] = useState<string[]>(groups.map((group) => group.id));
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showOnlineGroups, setShowOnlineGroups] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<"public" | "members">("public");
  const [showPinHistory, setShowPinHistory] = useState(true);
  const [locationPrecision, setLocationPrecision] = useState<"neighbourhood" | "suburb" | "city">("suburb");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string>("");

  const joinedGroups = useMemo(() => allGroups.filter((group) => Boolean(group.is_member)), [allGroups]);
  const visiblePins = useMemo(
    () => pins.filter((pin) => !pin.posted_by || !blockedIds.has(pin.posted_by)),
    [pins, blockedIds],
  );
  const focusedPinFromQuery = useMemo(
    () => (focusPinId ? pins.find((entry) => entry.id === focusPinId) || null : null),
    [focusPinId, pins],
  );
  const mapFocusPin = selectedPin || focusedPinFromQuery;
  const discoverGroups = useMemo(() => {
    const needle = discoverQuery.trim().toLowerCase();
    return allGroups
      .filter((group) => group.is_public)
      .filter((group) => {
        if (!needle) return true;
        return (
          group.name.toLowerCase().includes(needle) ||
          String(group.description || "").toLowerCase().includes(needle) ||
          String(group.location_label || "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => Number(Boolean(b.is_member)) - Number(Boolean(a.is_member)));
  }, [allGroups, discoverQuery]);
  const isLeftPanel = activePanel === "discover" || activePanel === "explore";
  const myGroups = useMemo(() => allGroups.filter((group) => Boolean(group.is_member)), [allGroups]);
  const onlineGroups = useMemo(() => allGroups.filter((group) => group.is_virtual), [allGroups]);
  const effectiveActiveGroupId = useMemo(() => {
    if (!myGroups.length) return "";
    if (activeGroupId && myGroups.some((group) => group.id === activeGroupId)) {
      return activeGroupId;
    }
    return myGroups[0].id;
  }, [activeGroupId, myGroups]);

  useEffect(() => {
    if (!currentUserId) return;
    const run = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", currentUserId);
      setBlockedIds(new Set((data || []).map((entry) => entry.blocked_id)));
    };
    void run();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    let mounted = true;
    const loadNotifications = async (includeList: boolean) => {
      if (includeList) setNotificationsLoading(true);
      const response = await fetch("/api/notifications");
      if (!mounted) return;
      if (!response.ok) {
        if (includeList) setNotifications([]);
        setUnreadCount(0);
        if (includeList) setNotificationsLoading(false);
        return;
      }
      const data = await response.json();
      if (includeList) {
        setNotifications(data.notifications || []);
        setNotificationsLoading(false);
      }
      setUnreadCount(data.unread_count || 0);
    };

    void loadNotifications(activePanel === "notifications");
    return () => {
      mounted = false;
    };
  }, [activePanel, currentUserId]);

  useEffect(() => {
    if (activePanel !== "settings" || !currentUserId) return;
    let mounted = true;
    const loadSettings = async () => {
      const response = await fetch("/api/profile/settings");
      if (!mounted || !response.ok) return;
      const data = await response.json();
      if (!mounted) return;
      setProfileVisibility(data.profile_visibility || "public");
      setShowPinHistory(data.show_pin_history ?? true);
      setLocationPrecision(data.location_precision || "suburb");
    };
    void loadSettings();
    return () => {
      mounted = false;
    };
  }, [activePanel, currentUserId]);

  const closePanel = () => router.replace("/map");
  const openPanel = (panel: "discover" | "explore" | "notifications" | "profile" | "settings") =>
    router.replace(`/map?panel=${panel}`);

  const joinGroup = async (groupId: string) => {
    const response = await fetch(`/api/groups/${groupId}/join`, { method: "POST" });
    if (!response.ok) return;
    setAllGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, is_member: true, member_count: (group.member_count || 0) + 1 }
          : group,
      ),
    );
    setVisibleGroupIds((prev) => (prev.includes(groupId) ? prev : [...prev, groupId]));
  };

  const signOut = async () => {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    await fetch("/api/profile/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_visibility: profileVisibility,
        show_pin_history: showPinHistory,
        location_precision: locationPrecision,
      }),
    });
    setSettingsSaving(false);
  };

  const toggleGroup = (groupId: string) => {
    setVisibleGroupIds((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  };

  return (
    <main className="h-screen w-full">
      <header className="flex h-12 items-center justify-between border-b border-slate-700 bg-slate-900 px-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">Community Map</span>
          <button
            type="button"
            onClick={() => openPanel("discover")}
            className={`rounded px-2 py-1 text-xs ${activePanel === "discover" ? "bg-blue-600 text-white" : "border border-slate-600 text-slate-300"}`}
          >
            Discover
          </button>
          <button
            type="button"
            onClick={() => openPanel("explore")}
            className={`rounded px-2 py-1 text-xs ${activePanel === "explore" ? "bg-blue-600 text-white" : "border border-slate-600 text-slate-300"}`}
          >
            Explore
          </button>
          {myGroups.length > 0 ? (
            <select
              value={effectiveActiveGroupId}
              onChange={(event) => setActiveGroupId(event.target.value)}
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              title="Active group for new group pins"
            >
              {myGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  Post to: {group.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openPanel("notifications")}
            className={`relative rounded px-2 py-1 text-xs ${activePanel === "notifications" ? "bg-blue-600 text-white" : "border border-slate-600 text-slate-300"}`}
          >
            Notifications
            {unreadCount > 0 ? (
              <span className="absolute -right-2 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => openPanel("settings")}
            className={`rounded px-2 py-1 text-xs ${activePanel === "settings" ? "bg-blue-600 text-white" : "border border-slate-600 text-slate-300"}`}
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => openPanel("profile")}
            className={`rounded px-2 py-1 text-xs ${activePanel === "profile" ? "bg-blue-600 text-white" : "border border-slate-600 text-slate-300"}`}
          >
            Profile
          </button>
          {activePanel ? (
            <button type="button" onClick={closePanel} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300">
              Close
            </button>
          ) : null}
        </div>
      </header>
      <div className="relative">
        <LiveMap
          pins={visiblePins}
          groups={allGroups}
          visibleGroupIds={visibleGroupIds}
          focusPin={mapFocusPin}
          onPinSelect={(pin) => setSelectedPin(pin)}
          onPinPlace={currentUserId ? (lat, lng) => setPlacedCoords({ lat, lng }) : undefined}
        />
        {selectedPin ? (
          <PinPopup
            pin={selectedPin}
            onClose={() => setSelectedPin(null)}
            currentUserId={currentUserId}
            onPinUpdated={(updatedPin) => {
              setPins((prev) => prev.map((pin) => (pin.id === updatedPin.id ? { ...pin, ...updatedPin } : pin)));
              setSelectedPin((prev) => (prev && prev.id === updatedPin.id ? { ...prev, ...updatedPin } : prev));
            }}
          />
        ) : null}
        {placedCoords ? (
          <PlacePinModal
            latitude={placedCoords.lat}
            longitude={placedCoords.lng}
            joinedGroups={joinedGroups}
            defaultGroupId={effectiveActiveGroupId || undefined}
            currentUserId={currentUserId}
            onClose={() => setPlacedCoords(null)}
            onSuccess={(pin) => setPins((prev) => [pin, ...prev])}
          />
        ) : null}
        {adminGroupIds.map((groupId) => (
          <AdminVicariousOverlay key={`vicarious-${groupId}`} groupId={groupId} />
        ))}

        {activePanel ? (
          <aside
            className={`absolute inset-y-0 z-30 w-full max-w-md overflow-y-auto bg-slate-900/95 p-3 pb-24 backdrop-blur ${
              isLeftPanel ? "left-0 border-r border-slate-700" : "right-0 border-l border-slate-700"
            }`}
          >
            {activePanel === "discover" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Discover groups</h2>
                  {currentUserId ? (
                    <Link href="/groups/create" className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold">
                      Create group
                    </Link>
                  ) : null}
                </div>
                <input
                  value={discoverQuery}
                  onChange={(event) => setDiscoverQuery(event.target.value)}
                  placeholder="Search groups"
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                />
                <div className="space-y-2">
                  {discoverGroups.length === 0 ? <p className="text-sm text-slate-400">No matching groups.</p> : null}
                  {discoverGroups.map((group) => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      memberCount={group.member_count || 0}
                      isMember={Boolean(group.is_member)}
                      onJoin={group.is_member || !currentUserId ? undefined : () => void joinGroup(group.id)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {activePanel === "explore" ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Explore layers</h2>
                <div className="rounded border border-slate-700 bg-slate-800 p-2">
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVisibleGroupIds(allGroups.map((group) => group.id))}
                      className="rounded border border-slate-600 px-2 py-1 text-xs"
                    >
                      Show all
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibleGroupIds(allGroups.filter((group) => group.is_member).map((group) => group.id))}
                      className="rounded border border-slate-600 px-2 py-1 text-xs"
                    >
                      My groups
                    </button>
                  </div>
                  <div className="space-y-2">
                    {allGroups.map((group) => (
                      <label key={group.id} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm">
                        <span className="truncate">{group.name}</span>
                        <input
                          type="checkbox"
                          checked={visibleGroupIds.includes(group.id)}
                          onChange={() => toggleGroup(group.id)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activePanel === "notifications" ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Notifications</h2>
                {notificationsLoading ? <p className="text-sm text-slate-400">Loading notifications...</p> : null}
                {!notificationsLoading && notifications.length === 0 ? <p className="text-sm text-slate-400">No notifications yet.</p> : null}
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onOpen={() => {
                        router.replace(notification.pin_id ? `/map?pin=${notification.pin_id}` : "/map");
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {activePanel === "profile" ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Profile</h2>
                {currentUserId ? (
                  <>
                    <Link href={`/profile/${currentUserId}`} className="block rounded border border-slate-600 px-3 py-2 text-sm">
                      View my profile
                    </Link>
                    <Link href="/groups/create" className="block rounded border border-slate-600 px-3 py-2 text-sm">
                      Create a group
                    </Link>
                    <button
                      type="button"
                      onClick={() => void signOut()}
                      disabled={isSigningOut}
                      className="w-full rounded border border-rose-700 px-3 py-2 text-sm text-rose-300 disabled:opacity-70"
                    >
                      {isSigningOut ? "Signing out..." : "Sign out"}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Sign in to view profile actions.</p>
                )}
              </div>
            ) : null}

            {activePanel === "settings" ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Settings</h2>
                <div className="rounded border border-slate-700 bg-slate-800 p-3 text-sm">
                  <label className="mb-2 block">
                    <span className="mb-1 block text-slate-300">Profile visibility</span>
                    <select
                      value={profileVisibility}
                      onChange={(event) => setProfileVisibility(event.target.value as "public" | "members")}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                    >
                      <option value="public">Public</option>
                      <option value="members">Members only</option>
                    </select>
                  </label>
                  <label className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-slate-300">Show pin history</span>
                    <input type="checkbox" checked={showPinHistory} onChange={(event) => setShowPinHistory(event.target.checked)} />
                  </label>
                  <label className="mb-2 block">
                    <span className="mb-1 block text-slate-300">Location precision</span>
                    <select
                      value={locationPrecision}
                      onChange={(event) => setLocationPrecision(event.target.value as "neighbourhood" | "suburb" | "city")}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                    >
                      <option value="neighbourhood">Neighbourhood</option>
                      <option value="suburb">Suburb</option>
                      <option value="city">City</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveSettings()}
                    disabled={settingsSaving}
                    className="mt-2 w-full rounded bg-blue-600 px-3 py-2 font-semibold disabled:opacity-70"
                  >
                    {settingsSaving ? "Saving..." : "Save settings"}
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}

        {onlineGroups.length > 0 ? (
          <div className="absolute bottom-4 left-3 z-20">
            <button
              type="button"
              onClick={() => setShowOnlineGroups((prev) => !prev)}
              className="rounded-full border border-slate-600 bg-slate-900/95 px-3 py-1.5 text-xs text-slate-200 backdrop-blur"
            >
              Online groups ({onlineGroups.length})
            </button>
            {showOnlineGroups ? (
              <div className="mt-2 w-64 max-h-52 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-2 backdrop-blur">
                <div className="space-y-1">
                  {onlineGroups.map((group) => (
                    <Link
                      key={group.id}
                      href={`/groups/${group.id}`}
                      className="block rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                    >
                      {group.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
