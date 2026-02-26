'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts';

interface Product {
  id: number;
  ticketId: string;
  code: string | null;
  numberUnits: number | null;
  vat: number | null;
  netAmount: number | null;
  subFamily: string | null;
  description: string | null;
  auxiliaryData: Record<string, unknown> | null;
}

const SUBFAMILY_COLORS = [
  '#e8a820', '#60a5fa', '#4ade80', '#f97316', '#c084fc',
  '#f472b6', '#22d3ee', '#94a3b8', '#fbbf24', '#fb923c',
  '#a78bfa', '#34d399', '#f87171', '#38bdf8', '#facc15',
];

const fmt = (n: number) =>
  `€${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '20px 24px',
      flex: '1 1 160px',
    }}>
      <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '8px' }}>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 500, color: 'var(--gold)', lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '6px' }}>{sub}</p>
      )}
    </div>
  );
}

const MoneyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
      borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '13px',
    }}>
      <p style={{ color: 'var(--text-2)', marginBottom: '4px', fontFamily: 'var(--font-display)', fontSize: '12px' }}>{label}</p>
      <p style={{ color: payload[0].fill || 'var(--gold)', fontWeight: 600 }}>{fmt(payload[0].value)}</p>
    </div>
  );
};

const UnitsTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
      borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '13px',
    }}>
      <p style={{ color: 'var(--text-2)', marginBottom: '4px', fontFamily: 'var(--font-display)', fontSize: '12px' }}>{label}</p>
      <p style={{ color: '#4ade80', fontWeight: 600 }}>{payload[0].value} units</p>
    </div>
  );
};

function Section({ title, children, noPad }: { title: string; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      marginBottom: '16px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ width: '3px', height: '16px', background: 'var(--gold)', borderRadius: '2px', display: 'inline-block' }} />
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--text-1)', letterSpacing: '-0.2px', margin: 0 }}>
          {title}
        </h2>
      </div>
      <div style={noPad ? {} : { padding: '20px' }}>
        {children}
      </div>
    </div>
  );
}

export default function Carrefour() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/carrefour/products');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setProducts(data.data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Aggregate by description across all purchases
  const byDesc = useMemo(() => {
    const map: Record<string, { totalSpend: number; totalUnits: number; unitPrices: number[] }> = {};
    products.forEach(p => {
      if (!p.description) return;
      const key = p.description;
      if (!map[key]) map[key] = { totalSpend: 0, totalUnits: 0, unitPrices: [] };
      map[key].totalSpend += p.netAmount || 0;
      map[key].totalUnits += p.numberUnits || 0;
      if (p.netAmount && p.numberUnits && p.numberUnits > 0) {
        map[key].unitPrices.push(p.netAmount / p.numberUnits);
      }
    });
    return map;
  }, [products]);

  // Top 10 by total spend
  const topSpend = useMemo(() =>
    Object.entries(byDesc)
      .map(([name, d]) => ({ name, value: Math.round(d.totalSpend * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    [byDesc]);

  // Top 10 most purchased by units
  const topUnits = useMemo(() =>
    Object.entries(byDesc)
      .map(([name, d]) => ({ name, value: d.totalUnits }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    [byDesc]);

  // Top 10 most expensive by average unit price
  const topUnitPrice = useMemo(() =>
    Object.entries(byDesc)
      .filter(([, d]) => d.unitPrices.length > 0)
      .map(([name, d]) => {
        const avg = d.unitPrices.reduce((a, b) => a + b, 0) / d.unitPrices.length;
        return { name, value: Math.round(avg * 100) / 100 };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    [byDesc]);

  // Spend by subFamily
  const subFamilySpend = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      const cat = p.subFamily || 'OTHER';
      map[cat] = (map[cat] || 0) + (p.netAmount || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [products]);

  // Summary stats
  const stats = useMemo(() => {
    const totalSpend = products.reduce((s, p) => s + (p.netAmount || 0), 0);
    const totalUnits = products.reduce((s, p) => s + (p.numberUnits || 0), 0);
    const uniqueProducts = Object.keys(byDesc).length;
    return { totalSpend, totalUnits, uniqueProducts };
  }, [products, byDesc]);

  if (loading) return (
    <div style={{ padding: '40px 24px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="shimmer" style={{ flex: '1 1 160px', height: '90px', borderRadius: '10px' }} />
      ))}
    </div>
  );

  if (error) return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-display)' }}>
      <p style={{ color: '#f87171' }}>⚠ {error}</p>
    </div>
  );

  const axisStyle = { fontFamily: 'var(--font-mono)', fontSize: 11, fill: '#52525b' };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Total Spend" value={fmt(stats.totalSpend)} sub={`${products.length} line items`} />
        <StatCard label="Unique Products" value={String(stats.uniqueProducts)} sub="distinct items" />
        <StatCard label="Total Units" value={String(stats.totalUnits)} sub="items purchased" />
        <StatCard
          label="Top Product"
          value={truncate(topSpend[0]?.name || '—', 18)}
          sub={topSpend[0] ? fmt(topSpend[0].value) : undefined}
        />
        <StatCard
          label="Most Bought"
          value={truncate(topUnits[0]?.name || '—', 18)}
          sub={topUnits[0] ? `${topUnits[0].value} units` : undefined}
        />
      </div>

      {/* ── TOP SPEND + MOST EXPENSIVE ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>

        {topSpend.length > 0 && (
          <Section title="Top Products by Total Spend" noPad>
            <div style={{ padding: '0 16px 16px' }}>
              <ResponsiveContainer width="100%" height={Math.max(200, topSpend.length * 40)}>
                <BarChart data={topSpend} layout="vertical" barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 11 }} axisLine={false} tickLine={false} width={130} tickFormatter={n => truncate(n, 17)} />
                  <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {topSpend.map((_, i) => (
                      <Cell key={i} fill={`rgba(232,168,32,${0.95 - i * 0.08})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}

        {topUnitPrice.length > 0 && (
          <Section title="Most Expensive (Avg Unit Price)" noPad>
            <div style={{ padding: '0 16px 16px' }}>
              <ResponsiveContainer width="100%" height={Math.max(200, topUnitPrice.length * 40)}>
                <BarChart data={topUnitPrice} layout="vertical" barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 11 }} axisLine={false} tickLine={false} width={130} tickFormatter={n => truncate(n, 17)} />
                  <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {topUnitPrice.map((_, i) => (
                      <Cell key={i} fill={`rgba(249,115,22,${0.95 - i * 0.08})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}
      </div>

      {/* ── MOST PURCHASED ─────────────────────────────────────────────── */}
      {topUnits.length > 0 && (
        <Section title="Most Purchased Products (by Units)" noPad>
          <div style={{ padding: '0 16px 16px' }}>
            <ResponsiveContainer width="100%" height={Math.max(200, topUnits.length * 40)}>
              <BarChart data={topUnits} layout="vertical" barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 11 }} axisLine={false} tickLine={false} width={150} tickFormatter={n => truncate(n, 20)} />
                <Tooltip content={<UnitsTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {topUnits.map((_, i) => (
                    <Cell key={i} fill={`rgba(74,222,128,${0.95 - i * 0.08})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

    </div>
  );
}