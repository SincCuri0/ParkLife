"use client";

import Map, { MapMouseEvent, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

interface GroupCreateMapProps {
  latitude: number;
  longitude: number;
  onPick: (lat: number, lng: number) => void;
}

export default function GroupCreateMap({ latitude, longitude, onPick }: GroupCreateMapProps) {
  return (
    <div className="h-64 overflow-hidden rounded border border-slate-700">
      <Map
        initialViewState={{ latitude, longitude, zoom: 11 }}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onClick={(event: MapMouseEvent) => {
          onPick(event.lngLat.lat, event.lngLat.lng);
        }}
      >
        <Marker longitude={longitude} latitude={latitude} />
      </Map>
    </div>
  );
}
