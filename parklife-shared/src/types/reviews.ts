export interface RoseThornBudBanana {
  rose: string;
  thorn?: string | null;
  bud?: string | null;
  banana?: string | null;
}

export interface Review extends RoseThornBudBanana {
  id: string;
  fromUserId: string;
  toUserId: string;
  createdAt: string;
}
