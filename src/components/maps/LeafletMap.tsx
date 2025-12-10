import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  label?: string;
  content?: string;
  color?: string;
}

export interface LeafletMapProps {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  onMarkerClick?: (marker: MapMarker) => void;
  height?: string;
  fitBounds?: boolean;
  maxZoom?: number;
}

export type MapLayerType = 'osm' | 'satellite' | 'terrain' | 'dark';

/**
 * Enhanced Leaflet-based map component using OpenStreetMap tiles
 * Features: Multiple layer modes, satellite view, terrain, dark mode, controls
 */
export const LeafletMap: React.FC<LeafletMapProps> = ({
  markers,
  center = { lat: 11.1271, lng: 78.6569 }, // Default: Tamil Nadu
  zoom = 12,
  onMarkerClick,
  height = '500px',
  fitBounds = true,
  maxZoom = 15,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const layersRef = useRef<Record<string, L.TileLayer>>({});
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('osm');

  // Create custom icon for markers
  const createMarkerIcon = (color: string = '#22c55e', label?: string) => {
    const svg = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="12" cy="12" r="9" fill="${color}" stroke="${color}" stroke-width="0.5" opacity="0.3"/>
        ${label ? `<text x="12" y="15" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">${label}</text>` : ''}
      </svg>
    `;

    return L.divIcon({
      html: svg,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
      className: 'leaflet-marker-icon',
    });
  };

  // Initialize tile layers
  const initializeLayers = (map: L.Map) => {
    // OpenStreetMap Standard
    layersRef.current.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    });

    // Satellite/Aerial (USGS)
    layersRef.current.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '© Esri',
    });

    // Terrain
    layersRef.current.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '© OpenTopoMap',
    });

    // Dark Mode
    layersRef.current.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© CartoDB',
    });

    // Add OSM by default
    layersRef.current.osm.addTo(map);
  };

  // Switch between map layers
  const switchLayer = (layer: MapLayerType) => {
    if (!mapInstanceRef.current) return;

    // Remove current layer
    Object.values(layersRef.current).forEach(tl => mapInstanceRef.current!.removeLayer(tl));

    // Add new layer
    layersRef.current[layer].addTo(mapInstanceRef.current);
    setCurrentLayer(layer);
  };

  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    // Initialize map if not already done
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true,
      }).setView([center.lat, center.lng], zoom);

      // Initialize all tile layers
      initializeLayers(mapInstanceRef.current);

      // Add fullscreen control only (no overlay layer control)
      if (document.fullscreenEnabled) {
        const fullscreenControl = L.Control.extend({
          onAdd: () => {
            const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar');
            const button = L.DomUtil.create('a', '', div);
            button.innerHTML = '⛶';
            button.title = 'Toggle Fullscreen';
            button.style.cssText = `
              font-size: 18px;
              width: 36px;
              height: 36px;
              line-height: 36px;
              text-align: center;
              cursor: pointer;
              user-select: none;
            `;
            L.DomEvent.on(button, 'click', () => {
              if (mapRef.current?.requestFullscreen) {
                mapRef.current.requestFullscreen();
              }
            });
            return div;
          },
        });
        new fullscreenControl({ position: 'topright' }).addTo(mapInstanceRef.current);
      }

      // Layer control is now managed by the parent page component
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (markers.length === 0) {
      mapInstanceRef.current.setView([center.lat, center.lng], zoom);
      return;
    }

    // Add new markers
    const bounds = L.latLngBounds([]);
    let hasValidMarkers = false;

    markers.forEach((markerData, index) => {
      if (!markerData.latitude || !markerData.longitude) return;

      hasValidMarkers = true;
      const position = [markerData.latitude, markerData.longitude] as [number, number];
      bounds.extend(position);

      const marker = L.marker(position, {
        icon: createMarkerIcon(markerData.color || '#22c55e', markerData.label || String(index + 1)),
        title: markerData.title,
      }).addTo(mapInstanceRef.current!);

      // Enhanced popup with better styling
      if (markerData.content) {
        marker.bindPopup(markerData.content, {
          maxWidth: 280,
          maxHeight: 350,
          closeButton: true,
          className: 'leaflet-popup-enhanced',
        });
      } else {
        marker.bindPopup(`<div style="padding: 10px; font-weight: 600;">${markerData.title}</div>`);
      }

      // Handle marker click
      marker.on('click', () => {
        marker.openPopup();
        onMarkerClick?.(markerData);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds if we have markers
    if (hasValidMarkers && fitBounds && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { maxZoom, padding: [50, 50] });
    }
  }, [markers, center, zoom, onMarkerClick, fitBounds, maxZoom, currentLayer]);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
        }}
      />
      <style>{`
        .leaflet-control-layers-custom {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }
        
        .leaflet-control-zoom {
          border-radius: 8px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12) !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          overflow: hidden;
        }
        
        .leaflet-control-zoom a {
          background-color: white !important;
          color: #1f2937 !important;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
          font-weight: 600;
          font-size: 16px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          width: 40px !important;
          height: 40px !important;
          line-height: 40px !important;
        }
        
        .leaflet-control-zoom a:hover {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
          color: white !important;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3) !important;
        }
        
        .leaflet-control-zoom a:last-child {
          border-bottom: none !important;
        }
        
        .leaflet-popup-enhanced {
          border-radius: 8px;
        }
        
        .leaflet-popup-enhanced .leaflet-popup-content-wrapper {
          border-radius: 8px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.16);
          border: 1px solid rgba(0, 0, 0, 0.08);
          padding: 0;
        }
        
        .leaflet-popup-enhanced .leaflet-popup-content {
          margin: 0;
          width: auto !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .leaflet-popup-enhanced .leaflet-popup-tip {
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.08);
        }
        
        .leaflet-popup-enhanced .leaflet-popup-close-button {
          color: #6b7280;
          transition: all 0.2s ease;
        }
        
        .leaflet-popup-enhanced .leaflet-popup-close-button:hover {
          color: #1f2937;
        }

        .leaflet-control-button {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .leaflet-control-button:hover {
          transform: translateY(-2px);
        }

        /* Attribution styling */
        .leaflet-control-attribution {
          background-color: rgba(255, 255, 255, 0.9) !important;
          backdrop-filter: blur(10px);
          border-radius: 6px !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          font-size: 11px !important;
          padding: 8px 12px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
        }

        /* Leaflet marker styling */
        .leaflet-marker-icon {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
          transition: transform 0.2s ease;
        }

        .leaflet-marker-icon:hover {
          transform: scale(1.2);
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25));
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .leaflet-control-zoom {
            margin: 12px !important;
          }
          
          .leaflet-control-layers-custom {
            margin: 12px !important;
          }
        }
      `}</style>
    </div>
  );
};
