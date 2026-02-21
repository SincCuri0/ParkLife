interface PinExpiryBadgeProps {
  expiresAt: string | null;
  isResolved: boolean;
}

function daysRemaining(expiresAt: string) {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function PinExpiryBadge({ expiresAt, isResolved }: PinExpiryBadgeProps) {
  if (isResolved) {
    return <span className="rounded-full bg-emerald-900/40 px-2 py-1 text-xs text-emerald-300">Resolved</span>;
  }
  if (!expiresAt) {
    return null;
  }

  const expiresMs = new Date(expiresAt).getTime();
  // eslint-disable-next-line react-hooks/purity
  if (Number.isNaN(expiresMs) || expiresMs < Date.now()) {
    return <span className="rounded-full bg-rose-900/30 px-2 py-1 text-xs text-rose-300">Expired</span>;
  }

  const days = daysRemaining(expiresAt);
  if (days <= 1) {
    return <span className="rounded-full bg-amber-900/40 px-2 py-1 text-xs text-amber-200">Expires today</span>;
  }

  return <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">Expires in {days} days</span>;
}
