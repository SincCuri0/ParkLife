"use client";

import Link from "next/link";

interface SessionEndScreenProps {
  groupName: string;
  groupInviteCode: string;
  guestName: string;
}

export default function SessionEndScreen({ groupName, groupInviteCode, guestName }: SessionEndScreenProps) {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5">
      <h2 className="text-2xl font-semibold">Session over</h2>
      <p className="mt-2 text-slate-300">Thanks for joining, {guestName}.</p>
      <p className="mt-1 text-slate-300">Want to be part of {groupName} properly? Join the community.</p>
      <div className="mt-4 flex flex-col gap-2">
        <Link href={`/join/${groupInviteCode}`} className="rounded bg-blue-600 px-4 py-2 text-center font-semibold">
          Join {groupName}
        </Link>
        <Link href="/" className="text-center text-sm text-slate-300 underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}
