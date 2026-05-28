import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const icon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41]
});

function ClickPicker({ onPick }) {
  useMapEvents({ click(e) { onPick?.(e.latlng); } });
  return null;
}

export default function MapView({ center = [23.8103, 90.4125], markers = [], onPick, height = 320, draggable = false, polyline = null, circles = [] }) {
  return (
    <div style={{ position: 'relative', height, width: '100%', borderRadius: 14, overflow: 'hidden', zIndex: 0 }}>
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {onPick && <ClickPicker onPick={onPick} />}
        {markers.map((m, i) => (
          <Marker
            key={`${m.lat}-${m.lng}-${m.title}`}
            position={[Number(m.lat), Number(m.lng)]}
            icon={icon}
            draggable={draggable && i === 0 && !!onPick}
            eventHandlers={draggable && i === 0 && onPick ? {
              dragend(e) { onPick(e.target.getLatLng()); }
            } : undefined}
          >
            <Popup><b>{m.title}</b><br />{m.description}</Popup>
          </Marker>
        ))}
        {polyline && polyline.length > 1 && (
          <Polyline positions={polyline} color="var(--green)" weight={3} opacity={0.8} />
        )}
        {circles.map((c, i) => (
          <Circle
            key={`${c.lat}-${c.lng}-${c.radius}-${i}`}
            center={[Number(c.lat), Number(c.lng)]}
            radius={Number(c.radius)}
            pathOptions={{
              color: c.color || '#0284c7',
              fillColor: c.fillColor || '#38bdf8',
              fillOpacity: c.fillOpacity ?? 0.18,
              weight: c.weight || 2,
            }}
          >
            <Popup><b>{c.title}</b><br />{c.description}</Popup>
          </Circle>
        ))}
      </MapContainer>
    </div>
  );
}
