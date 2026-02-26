export interface Ledger {
  communityId: string;
  userId: string;
  balance: number;
}

export interface Transaction {
  id: string;
  communityId: string;
  fromUserId: string | null;
  toUserId: string;
  amount: number;
  reason: string;
  transactionType: "node_hosting" | "help_completed" | "tip" | "moderation" | "participation";
  referenceId?: string | null;
  createdAt: string;
}
