import type { Point } from "@mystreetvendor/shared-types";
export type MapPin = {
  id: string;
  label: string;
  point: Point;
  radiusM?: number;
};
export type AreaMapProps = { origin: Point; pins: MapPin[]; label?: string };
