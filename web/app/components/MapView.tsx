'use client';

import { useEffect, useRef } from 'react';
import type { Expense } from './Map';

interface MapViewProps {
  expenses: Expense[];
  selectedId: number | null;
  onMarkerClick: (id: number) => void;
  centerTo: { lat: number; lng: number } | null;
}

export default function MapView({ expenses, selectedId, onMarkerClick, centerTo }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());
  const leafletLoadedRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (leafletLoadedRef.current) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => {
      leafletLoadedRef.current = true;
      initMap();
    };
    document.head.appendChild(script);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current || !(window as any).L) return;
    const L = (window as any).L;

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(mapRef.current).setView([41.3851, 2.1734], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CartoDB</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    updateMarkers();
  };

  const updateMarkers = () => {
    if (!mapInstanceRef.current || !(window as any).L) return;
    const L = (window as any).L;

    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    expenses.forEach(e => {
      if (!e.latitude || !e.longitude) return;

      const marker = L.circleMarker([e.latitude, e.longitude], {
        radius: 8,
        fillColor: '#e8a820',
        color: '#f0c060',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      }).addTo(mapInstanceRef.current)
        .bindPopup(`
          <div style="font-family:'Syne',sans-serif;min-width:160px">
            <div style="font-weight:700;font-size:15px;margin-bottom:6px;color:#f4f4f5">
              ${e.shopName || 'Unknown shop'}
            </div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:18px;color:#e8a820;margin-bottom:8px">
              ${e.currency || ''}${e.amount?.toFixed(2) ?? '—'}
            </div>
            <div style="font-size:11px;color:#a1a1aa">
              ${e.postTime ? new Date(e.postTime).toLocaleString('es-ES', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              }) : ''}
            </div>
          </div>
        `);

      marker.on('click', () => onMarkerClick(e.id));
      markersRef.current.set(e.id, marker);
    });

    if (expenses.length > 0 && !initializedRef.current) {
      const first = expenses[0];
      if (first.latitude && first.longitude) {
        mapInstanceRef.current.setView([first.latitude, first.longitude], 13);
        initializedRef.current = true;
      }
    }
  };

  useEffect(() => {
    if (leafletLoadedRef.current && mapInstanceRef.current) updateMarkers();
  }, [expenses]);

  useEffect(() => {
    if (centerTo && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([centerTo.lat, centerTo.lng], 16, {
        duration: 1.0, easeLinearity: 0.5,
      });
      const expense = expenses.find(e => e.latitude === centerTo.lat && e.longitude === centerTo.lng);
      if (expense) {
        const marker = markersRef.current.get(expense.id);
        if (marker) setTimeout(() => marker.openPopup(), 1100);
      }
    }
  }, [centerTo, expenses]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '100%' }} />
    </div>
  );
}
