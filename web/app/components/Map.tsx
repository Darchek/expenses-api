'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

export interface Expense {
  id: number;
  text: string | null;
  amount: number | null;
  currency: string | null;
  latitude: number | null;
  longitude: number | null;
  postTime: string | null;
  category: string | null;
  shopName: string | null;
  createdAt: string | null;
}

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <p style={{ color: 'var(--text-2)' }}>Loading map…</p>
    </div>
  ),
});

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: '🍽️', transport: '⛽', grocery: '🛒',
  entertainment: '🎬', health: '💊', shopping: '🛍️',
  travel: '✈️', utilities: '💡',
};

export default function Map() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [centerTo, setCenterTo] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    async function fetchExpenses() {
      try {
        const res = await fetch('/api/expenses?limit=500');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setExpenses(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchExpenses();
    const interval = setInterval(fetchExpenses, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = (expense: Expense) => {
    setSelectedId(expense.id);
    if (expense.latitude && expense.longitude) {
      setCenterTo({ lat: expense.latitude, lng: expense.longitude });
      setTimeout(() => setCenterTo(null), 1500);
    }
  };

  if (loading) return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3" style={{ borderColor: 'var(--gold)' }}></div>
        <p style={{ color: 'var(--text-2)', fontFamily: 'var(--font-display)' }}>Loading expenses…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <p style={{ color: '#f87171', fontFamily: 'var(--font-display)' }}>Error: {error}</p>
    </div>
  );

  const mapped = expenses.filter(e => e.latitude && e.longitude);

  return (
    <div className="flex flex-col md:flex-row" style={{ height: '100%', background: 'var(--bg)' }}>
      {/* Map */}
      <div className="w-full md:w-2/3 h-64 md:h-full order-1">
        <MapView
          expenses={mapped}
          selectedId={selectedId}
          onMarkerClick={setSelectedId}
          centerTo={centerTo}
        />
      </div>

      {/* Sidebar */}
      <div className="w-full md:w-1/3 h-auto md:h-full overflow-y-auto order-2"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
        <div className="p-4 sticky top-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', color: 'var(--text-1)' }}>
            📍 Expense Map
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '2px' }}>
            {mapped.length} location{mapped.length !== 1 ? 's' : ''}
          </p>
        </div>

        {mapped.length === 0 ? (
          <div className="p-8 text-center">
            <p style={{ fontSize: '32px' }}>📭</p>
            <p style={{ color: 'var(--text-2)', marginTop: '8px' }}>No expenses with location</p>
          </div>
        ) : (
          <div>
            {mapped.map(e => {
              const active = selectedId === e.id;
              return (
                <div key={e.id} onClick={() => handleClick(e)}
                  style={{
                    padding: '14px 16px',
                    cursor: 'pointer',
                    borderLeft: active ? '3px solid var(--gold)' : '3px solid transparent',
                    background: active ? 'var(--surface-2)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    transition: 'all 0.15s',
                  }}>
                  <div className="flex items-start gap-3">
                    <span style={{ fontSize: '20px', marginTop: '2px' }}>
                      {CATEGORY_EMOJI[e.category || ''] || '💳'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: 'var(--font-display)', fontWeight: 600,
                        fontSize: '14px', color: 'var(--text-1)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {e.shopName || 'Unknown shop'}
                      </p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--gold)', marginTop: '2px' }}>
                        {e.currency}{e.amount?.toFixed(2) ?? '—'}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
                        {e.postTime ? new Date(e.postTime).toLocaleString('es-ES', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        }) : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
