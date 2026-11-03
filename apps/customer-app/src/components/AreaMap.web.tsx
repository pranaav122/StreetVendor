import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { tokens } from "@mystreetvendor/design-tokens";
import type { AreaMapProps } from "./map-types";
import { Body } from "../ui";
import { useCopy } from "../language";

export default function AreaMap({
  origin,
  pins,
  label = "Nearby map",
}: AreaMapProps) {
  const { language, text } = useCopy();
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const view = L.map(container.current).setView(
      [origin.latitude, origin.longitude],
      14,
    );
    map.current = view;
    for (const control of view
      .getContainer()
      .querySelectorAll<HTMLElement>(".leaflet-control-zoom a")) {
      control.style.width = "48px";
      control.style.height = "48px";
      control.style.lineHeight = "48px";
      const caption = text(
        control.classList.contains("leaflet-control-zoom-in")
          ? "Zoom in"
          : "Zoom out",
      );
      control.setAttribute("aria-label", caption);
      control.title = caption;
    }
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19,
      },
    ).addTo(view);
    tiles.on("tileerror", () => setTileError(true));
    markers.current = L.layerGroup().addTo(view);
    return () => {
      // Remove listeners and tile work when the user hides the map or tracking ends.
      tiles.off();
      view.remove();
      map.current = null;
      markers.current = null;
    };
  }, [origin.latitude, origin.longitude, language]);
  useEffect(() => {
    if (!map.current || !markers.current) return;
    const layer = markers.current;
    layer.clearLayers();
    L.circleMarker([origin.latitude, origin.longitude], {
      radius: 7,
      color: tokens.color.text,
      fillOpacity: 1,
    }).addTo(layer);
    for (const pin of pins) {
      const circle = L.circle([pin.point.latitude, pin.point.longitude], {
        radius: pin.radiusM ?? 20,
        color: tokens.color.primary,
        fillOpacity: 0.12,
      }).addTo(layer);
      // Leaflet treats string popups as HTML; textContent keeps business names inert.
      const content = document.createElement("span");
      content.textContent = pin.label;
      circle.bindPopup(content);
    }
  }, [pins, origin.latitude, origin.longitude, language]);
  return (
    <>
      <div
        ref={container}
        role="region"
        aria-label={text(label)}
        style={{
          height: 300,
          width: "100%",
          borderRadius: 16,
          overflow: "hidden",
          isolation: "isolate",
          fontFamily: tokens.font.regular,
          fontSize: 16,
        }}
      />
      {tileError ? (
        <Body copy muted>
          Some map tiles are unavailable. You can still use the list.
        </Body>
      ) : null}
    </>
  );
}
