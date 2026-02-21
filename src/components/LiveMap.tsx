"use client";

import Map, { Layer, MapMouseEvent, NavigationControl, Source } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_DEFAULT_CENTER } from "@/lib/constants";
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

  useEffect(() => {
    if (!focusPin || !mapRef.current) {
      return;
    }

    mapRef.current.flyTo({
      center: [focusPin.longitude, focusPin.latitude],
      duration: 700,
    });
  }, [focusRequest, focusPin, focusPin?.id, focusPin?.latitude, focusPin?.longitude]);

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
