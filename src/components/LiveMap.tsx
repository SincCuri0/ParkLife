"use client";

import Map, { Layer, MapMouseEvent, NavigationControl, Source } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_DEFAULT_CENTER } from "@/lib/constants";
import { decodeGeohashCenter } from "@/lib/map/geohash";
import { Group, Pin } from "@/lib/types";
import PinMarker from "./PinMarker";
import type { MapRef } from "react-map-gl/mapbox";

interface LiveMapProps {
  sessionId?: string;
  pins: Pin[];
  groups?: Group[];
  visibleGroupIds?: string[];
  isHost?: boolean;
  focusPin?: Pin | null;
  focusRequest?: number;
  onPinPlace?: (lat: number, lng: number) => void;
  onPinSelect?: (pin: Pin) => void;
}

type HeatmapCell = {
  geohash: string;
  intensity: number;
  type: "ambient" | "lamp";
  last_active?: string;
};

type LampPosition = {
  user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
};

const HEATMAP_POLL_INTERVAL_MS = 60_000;

export default function LiveMap({
  sessionId,
  pins,
  groups = [],
  visibleGroupIds,
  isHost,
  focusPin,
  focusRequest,
  onPinPlace,
  onPinSelect,
}: LiveMapProps) {
  const [viewState, setViewState] = useState(MAP_DEFAULT_CENTER);
  const [renderTs] = useState(() => Date.now());
  const [heatmapCells, setHeatmapCells] = useState<HeatmapCell[]>([]);
  const [lamps, setLamps] = useState<LampPosition[]>([]);
  const mapRef = useRef<MapRef | null>(null);

  const enabledGroups = useMemo(
    () => new Set(visibleGroupIds && visibleGroupIds.length ? visibleGroupIds : groups.map((group) => group.id)),
    [groups, visibleGroupIds],
  );
  const visiblePins = useMemo(
    () =>
      pins.filter((pin) => {
        if (pin.status === "rejected") return false;
        if (pin.status === "resolved") {
          const resolvedAt = pin.updated_at ? new Date(pin.updated_at) : new Date(pin.created_at);
          const cutoff = new Date(renderTs - 24 * 60 * 60 * 1000);
          if (resolvedAt <= cutoff) return false;
        }
        if (!pin.group_id) return true;
        return enabledGroups.has(pin.group_id);
      }),
    [pins, enabledGroups, renderTs],
  );
  const groupGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: groups
        .filter((group) => enabledGroups.has(group.id) && !group.is_virtual && group.latitude !== null && group.longitude !== null)
        .map((group) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [group.longitude as number, group.latitude as number],
          },
          properties: {
            id: group.id,
            colour: group.colour,
            radiusKm: group.radius_km,
            isPrivate: !group.is_public,
          },
        })),
    }),
    [groups, enabledGroups],
  );
  const roundedZoom = Math.max(0, Math.round(viewState.zoom || 0));
  const heatmapGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: heatmapCells.flatMap((cell) => {
          const center = decodeGeohashCenter(cell.geohash);
          if (!center) return [];
          return [{
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [center.longitude, center.latitude],
            },
            properties: {
              intensity: Math.max(0, Math.min(1, Number(cell.intensity || 0))),
            },
          }];
        }),
    }),
    [heatmapCells],
  );
  const lampGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: lamps.flatMap((lamp) => {
          if (!Number.isFinite(lamp.latitude) || !Number.isFinite(lamp.longitude)) {
            return [];
          }
          return [{
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [lamp.longitude, lamp.latitude],
            },
            properties: {},
          }];
        }),
    }),
    [lamps],
  );

  useEffect(() => {
    if (!focusPin || !mapRef.current) {
      return;
    }

    mapRef.current.flyTo({
      center: [focusPin.longitude, focusPin.latitude],
      duration: 700,
    });
  }, [focusRequest, focusPin, focusPin?.id, focusPin?.latitude, focusPin?.longitude]);

  useEffect(() => {
    let cancelled = false;

    const refreshAmbientLayers = async () => {
      try {
        const bounds = mapRef.current?.getBounds();
        const bboxParam = bounds
          ? [
              bounds.getSouthWest().lng,
              bounds.getSouthWest().lat,
              bounds.getNorthEast().lng,
              bounds.getNorthEast().lat,
            ].join(",")
          : null;

        const heatmapParams = new URLSearchParams({
          zoom: String(roundedZoom),
          window: "30m",
        });
        if (bboxParam) {
          heatmapParams.set("bbox", bboxParam);
        }

        const lampsParams = bboxParam
          ? `?bbox=${encodeURIComponent(bboxParam)}`
          : "";

        const [heatmapResponse, lampsResponse] = await Promise.all([
          fetch(`/api/map/heatmap?${heatmapParams.toString()}`, { cache: "no-store" }),
          fetch(`/api/map/lamps${lampsParams}`, { cache: "no-store" }),
        ]);

        if (cancelled) {
          return;
        }

        if (heatmapResponse.ok) {
          const payload = await heatmapResponse.json() as { cells?: HeatmapCell[] };
          setHeatmapCells(Array.isArray(payload.cells) ? payload.cells : []);
        } else if (heatmapResponse.status === 404) {
          setHeatmapCells([]);
        }

        if (lampsResponse.ok) {
          const payload = await lampsResponse.json() as { lamps?: LampPosition[] };
          setLamps(Array.isArray(payload.lamps) ? payload.lamps : []);
        } else if (lampsResponse.status === 404) {
          setLamps([]);
        }
      } catch {
        if (!cancelled) {
          // Keep the previous ambient state on transient fetch errors.
        }
      }
    };

    void refreshAmbientLayers();
    const interval = setInterval(() => {
      void refreshAmbientLayers();
    }, HEATMAP_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roundedZoom]);

  const handleMapClick = (event: MapMouseEvent) => {
    if (isHost || !onPinPlace) {
      return;
    }
    onPinPlace(event.lngLat.lat, event.lngLat.lng);
  };

  return (
    <div className="h-[calc(100vh-48px)] w-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(event) => setViewState(event.viewState)}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onClick={handleMapClick}
        reuseMaps
      >
        <NavigationControl position="bottom-right" />
        {heatmapGeoJson.features.length > 0 ? (
          <Source id="heatmap-cells" type="geojson" data={heatmapGeoJson}>
            <Layer
              id="heatmap-cells-layer"
              type="circle"
              paint={{
                "circle-color": "#E8A830",
                "circle-opacity": [
                  "interpolate",
                  ["linear"],
                  ["get", "intensity"],
                  0,
                  0.06,
                  1,
                  0.32,
                ],
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  3,
                  20,
                  8,
                  34,
                  12,
                  52,
                ],
              }}
            />
          </Source>
        ) : null}
        {lampGeoJson.features.length > 0 ? (
          <Source id="lamp-points" type="geojson" data={lampGeoJson}>
            <Layer
              id="lamp-points-layer"
              type="circle"
              paint={{
                "circle-color": "#E8A830",
                "circle-opacity": 0.8,
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  3,
                  3,
                  10,
                  5,
                  14,
                  7,
                ],
                "circle-stroke-color": "#F5EDD6",
                "circle-stroke-opacity": 0.65,
                "circle-stroke-width": 1,
              }}
            />
          </Source>
        ) : null}
        {groupGeoJson.features.length > 0 ? (
          <Source id="group-areas" type="geojson" data={groupGeoJson}>
            <Layer
              id="group-areas-fill"
              type="circle"
              paint={{
                "circle-color": ["get", "colour"],
                "circle-opacity": 0.15,
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  3,
                  ["*", ["get", "radiusKm"], 2],
                  12,
                  ["*", ["get", "radiusKm"], 15],
                  16,
                  ["*", ["get", "radiusKm"], 40],
                ],
                "circle-stroke-color": ["get", "colour"],
                "circle-stroke-opacity": 0.4,
                "circle-stroke-width": 2,
              }}
            />
          </Source>
        ) : null}
        {visiblePins.map((pin) => (
          <PinMarker key={`${sessionId || "map"}-${pin.id}`} pin={pin} onClick={(selected) => onPinSelect?.(selected)} />
        ))}
      </Map>
    </div>
  );
}
