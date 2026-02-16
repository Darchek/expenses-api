'use client';

import { useEffect, useRef } from 'react';

interface Notification {
  id: number;
  packageName: string;
  title: string | null;
  text: string | null;
  latitude: number | null;
  longitude: number | null;
  postTime: number;
  createdAt: string;
}

interface MapViewProps {
  notifications: Notification[];
  selectedId: number | null;
  onMarkerClick: (id: number) => void;
  centerTo: { lat: number; lng: number } | null;
}

export default function MapView({ notifications, selectedId, onMarkerClick, centerTo }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());
  const leafletLoadedRef = useRef(false);
  const initializedRef = useRef(false);

  // Load Leaflet from CDN
  useEffect(() => {
    if (leafletLoadedRef.current) return;

    // Add Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    // Add Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    
    script.onload = () => {
      leafletLoadedRef.current = true;
      initializeMap();
    };

    document.head.appendChild(script);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const initializeMap = () => {
    if (!mapRef.current || mapInstanceRef.current || !(window as any).L) return;

    const L = (window as any).L;

    // Fix Leaflet icon paths
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // Create map
    const map = L.map(mapRef.current).setView([41.3851, 2.1734], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    mapInstanceRef.current = map;
    updateMarkers();
  };

  const updateMarkers = () => {
    if (!mapInstanceRef.current || !(window as any).L) return;

    const L = (window as any).L;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    const validNotifications = notifications.filter(
      (n) => n.latitude !== null && n.longitude !== null
    );

    // Add markers
    validNotifications.forEach((notification) => {
      const marker = L.marker([notification.latitude!, notification.longitude!])
        .addTo(mapInstanceRef.current)
        .bindPopup(`
          <div style="padding: 8px;">
            <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">
              ${notification.title || 'No title'}
            </h3>
            <p style="font-size: 13px; color: #374151; margin-bottom: 8px;">
              ${notification.text || 'No text'}
            </p>
            <p style="font-size: 11px; color: #6b7280;">
              ${new Date(notification.postTime).toLocaleString()}
            </p>
          </div>
        `);

      marker.on('click', () => {
        onMarkerClick(notification.id);
      });

      markersRef.current.set(notification.id, marker);
    });

    // Center on first notification only on initial load
    if (validNotifications.length > 0 && !initializedRef.current) {
      mapInstanceRef.current.setView(
        [validNotifications[0].latitude!, validNotifications[0].longitude!],
        13
      );
      initializedRef.current = true;
    }
  };

  // Update markers when notifications change
  useEffect(() => {
    if (leafletLoadedRef.current && mapInstanceRef.current) {
      updateMarkers();
    }
  }, [notifications]);

  // Handle centering when requested
  useEffect(() => {
    if (centerTo && mapInstanceRef.current) {
      // Use flyTo for smooth animation
      mapInstanceRef.current.flyTo([centerTo.lat, centerTo.lng], 16, {
        duration: 1.0,
        easeLinearity: 0.5
      });

      // Find and open popup for the selected marker
      const notification = notifications.find(
        n => n.latitude === centerTo.lat && n.longitude === centerTo.lng
      );
      
      if (notification) {
        const marker = markersRef.current.get(notification.id);
        if (marker) {
          setTimeout(() => {
            marker.openPopup();
          }, 1100); // Open popup after fly animation completes
        }
      }
    }
  }, [centerTo, notifications]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '100%' }}></div>
      {!leafletLoadedRef.current && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <p className="text-gray-400">Loading map...</p>
        </div>
      )}
    </div>
  );
}
