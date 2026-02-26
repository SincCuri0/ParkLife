export type ArchetypeType =
  | "Lamplighter"
  | "Steward"
  | "Scout"
  | "Connector"
  | "Builder"
  | "Groundskeeper"
  | "Advocate";

export interface ArchetypeProfile {
  type: ArchetypeType;
  summary: string;
  updatedAt: string;
}
