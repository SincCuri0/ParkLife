"use client";

import Map, { MapMouseEvent, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_DEFAULT_CENTER } from "@/lib/constants";
import { Pin } from "@/lib/types";
import PinMarker from "./PinMarker";
import type { MapRef } from "react-map-gl/mapbox";

interface LiveMapProps {
  sessionId: string;
  pins: Pin[];
  isHost?: boolean;
  focusPin?: Pin | null;
  focusRequest?: number;
  onPinPlace?: (lat: number, lng: number) => void;
  onPinSelect?: (pin: Pin) => void;
}

export default function LiveMap({
  sessionId,
  pins,
  isHost,
  focusPin,
  focusRequest,
  onPinPlace,
  onPinSelect,
}: LiveMapProps) {
  const [viewState, setViewState] = useState(MAP_DEFAULT_CENTER);
  const mapRef = useRef<MapRef | null>(null);

  const visiblePins = useMemo(() => pins.filter((pin) => pin.status !== "rejected"), [pins]);

  useEffect(() => {
    if (!focusPin || !mapRef.current) {
      return;
    }

    mapRef.current.flyTo({
      center: [focusPin.longitude, focusPin.latitude],
      duration: 700,
    });
  }, [focusRequest, focusPin?.id, focusPin?.latitude, focusPin?.longitude]);

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
        {visiblePins.map((pin) => (
          <PinMarker key={`${sessionId}-${pin.id}`} pin={pin} onClick={(selected) => onPinSelect?.(selected)} />
        ))}
      </Map>
    </div>
  );
}
