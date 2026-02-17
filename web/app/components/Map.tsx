'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

interface Notification {
  id: number;
  packageName: string;
  title: string | null;
  text: string | null;
  amount: number | null;
  currency: string | null;
  latitude: number | null;
  longitude: number | null;
  postTime: number;
  createdAt: string;
  expenseType: string | null;
}

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-900">
      <p className="text-gray-400">Loading map...</p>
    </div>
  ),
});

export default function Map() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [centerTo, setCenterTo] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const response = await fetch('/notifications');
        if (!response.ok) {
          throw new Error('Failed to fetch notifications');
        }
        const data = await response.json();
        setNotifications(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleMarkerClick = (id: number) => {
    setSelectedId(id);
  };

  const handleNotificationClick = (notification: Notification) => {
    setSelectedId(notification.id);
    
    if (notification.latitude && notification.longitude) {
      setCenterTo({ lat: notification.latitude, lng: notification.longitude });
      setTimeout(() => setCenterTo(null), 1500);
    }
    
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-300">Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <p className="text-xl text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  const validNotifications = notifications.filter(
    (n) => n.latitude !== null && n.longitude !== null
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900">
      {/* Map - Left side on desktop, top on mobile */}
      <div className="w-full md:w-2/3 h-64 md:h-full order-1 md:order-1">
        <MapView
          notifications={validNotifications}
          selectedId={selectedId}
          onMarkerClick={handleMarkerClick}
          centerTo={centerTo}
        />
      </div>

      {/* List - Right side on desktop, bottom on mobile */}
      <div className="w-full md:w-1/3 h-auto md:h-full bg-gray-800 overflow-y-auto order-2 md:order-2">
        <div className="p-4 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>📍</span> Notifications AA
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {validNotifications.length} location{validNotifications.length !== 1 ? 's' : ''}
          </p>
        </div>

        {validNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-400">No notifications with location yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {validNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 cursor-pointer transition-colors hover:bg-gray-700 ${
                  selectedId === notification.id ? 'bg-gray-700 border-l-4 border-blue-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-1">
                    {notification.expenseType === 'restaurant' ? '🍽️' :
                     notification.expenseType === 'transport' ? '⛽' :
                     notification.expenseType === 'grocery' ? '🛒' :
                     notification.expenseType === 'entertainment' ? '🎬' :
                     notification.expenseType === 'health' ? '💊' :
                     notification.expenseType === 'shopping' ? '🛍️' :
                     notification.expenseType === 'travel' ? '✈️' :
                     notification.expenseType === 'utilities' ? '💡' :
                     '💳'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-sm md:text-base mb-1 truncate">
                      {notification.title || 'No title'}
                    </h3>
                    <p className="text-gray-300 text-xs md:text-sm mb-2 line-clamp-2">
                      {notification.amount !== null && notification.currency 
                        ? `${notification.currency}${notification.amount.toFixed(2)}` 
                        : 'No amount'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>📅</span>
                      <span>
                        {new Date(notification.postTime).toLocaleString('es-ES', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
