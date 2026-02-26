export interface HeatmapCell {
  geohash: string;
  intensity: number;
  type: "ambient" | "lamp";
}

export interface LampPosition {
  user_id: string;
  latitude: number;
  longitude: number;
}
