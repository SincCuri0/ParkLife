"use client";

import { Marker } from "react-map-gl/mapbox";
import { PIN_CATEGORY_ICONS, PIN_COLOURS } from "@/lib/constants";
import { Pin } from "@/lib/types";

interface PinMarkerProps {
  pin: Pin;
  onClick: (pin: Pin) => void;
}

export default function PinMarker({ pin, onClick }: PinMarkerProps) {
  const pinColour = pin.group_colour || PIN_COLOURS[pin.status];
  const categoryIcon = pin.category ? PIN_CATEGORY_ICONS[pin.category] : null;
  const label = pin.title || pin.description || `Pin by ${pin.author_name}`;

  return (
    <Marker longitude={pin.longitude} latitude={pin.latitude} anchor="center">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick(pin);
        }}
        title={label.slice(0, 40)}
        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs shadow-lg ${pin.status === "active" ? "pin-active" : ""} ${pin.status === "resolved" ? "opacity-60" : ""}`}
        style={{ backgroundColor: pinColour }}
        aria-label={label}
      >
        {categoryIcon ? <span className="pointer-events-none text-xs">{categoryIcon}</span> : null}
      </button>
    </Marker>
  );
}
