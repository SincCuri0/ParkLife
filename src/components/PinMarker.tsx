"use client";

import { Marker } from "react-map-gl/mapbox";
import { PIN_COLOURS } from "@/lib/constants";
import { Pin } from "@/lib/types";

interface PinMarkerProps {
  pin: Pin;
  onClick: (pin: Pin) => void;
}

export default function PinMarker({ pin, onClick }: PinMarkerProps) {
  return (
    <Marker longitude={pin.longitude} latitude={pin.latitude} anchor="center">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick(pin);
        }}
        className={`h-5 w-5 rounded-full border-2 border-white shadow-lg ${pin.status === "active" ? "pin-active" : ""}`}
        style={{ backgroundColor: PIN_COLOURS[pin.status] }}
        aria-label={`Pin by ${pin.author_name}`}
      />
    </Marker>
  );
}
