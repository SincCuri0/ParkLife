"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface BottomNavProps {
  currentUserId: string;
  unreadCount?: number;
}

export default function BottomNav({ currentUserId, unreadCount = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const items = [
    { label: "Map", href: "/map", panel: null },
    { label: "Discover", href: "/map?panel=discover", panel: "discover" },
    { label: "Alerts", href: "/map?panel=alerts", panel: "alerts" },
    { label: "Profile", href: "/map?panel=profile", panel: "profile" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-700 bg-slate-900/100 backdrop-blur"
      style={{ height: 56, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-full max-w-xl items-center justify-around px-2 text-sm">
        {items.map((item) => {
          const active = pathname === "/map" && ((item.panel === null && !panel) || item.panel === panel);
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                title={item.label === "Profile" ? `Profile ${currentUserId}` : undefined}
                className={active ? "relative font-semibold text-blue-400" : "relative text-slate-300 hover:text-slate-100"}
              >
                {item.label}
                {item.label === "Alerts" && unreadCount > 0 ? (
                  <span className="absolute -right-3 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
