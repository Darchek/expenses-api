'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProductHealthScore {
  total_score: number;
  rating: string;
}

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
  category: string | null;
  healthScore: ProductHealthScore | null;
}

interface Purchase {
  id: number;
  ticketId: string;
  date: string | null;
  name: string;
  netAmount: number | null;
  numberItems: number | null;
  healthScore: number | null;
  products: Product[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  `€${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s;

const healthColor = (score: number | null) => {
  if (score == null) return '#52526b';
  if (score >= 75) return '#4ade80';
  if (score >= 50) return '#f0b429';
  if (score >= 25) return '#fb923c';
  return '#f87171';
};

const healthLabel = (score: number | null) => {
  if (score == null) return 'No data';
  if (score >= 75) return 'Excellent';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Poor';
  return 'Bad';
};

const SUBFAMILY_COLORS = [
  '#f0b429', '#60a5fa', '#4ade80', '#f97316', '#a78bfa',
  '#f472b6', '#2dd4bf', '#94a3b8', '#fbbf24', '#fb923c',
  '#818cf8', '#34d399', '#f87171', '#38bdf8', '#facc15',
];

// Stable color per category name (hash-based)
function categoryColor(cat: string | null): string {
  if (!cat) return '#52526b';
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  return SUBFAMILY_COLORS[Math.abs(hash) % SUBFAMILY_COLORS.length];
}

// ── Health Score Ring ─────────────────────────────────────────────────────────
function HealthRing({ score, small }: { score: number | null; small?: boolean }) {
  const r = small ? 32 : 52;
  const sw = small ? 7 : 10;
  const dim = small ? 80 : 130;
  const cx = dim / 2;
  const circumference = 2 * Math.PI * r;
  const pct = score != null ? Math.max(0, Math.min(100, score)) : 0;
  const dash = (pct / 100) * circumference;
  const color = healthColor(score);
  const label = healthLabel(score);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: small ? '5px' : '8px' }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} style={{ overflow: 'visible' }}>
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke={color} strokeWidth={sw}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.4s ease' }}
        />
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke={color} strokeWidth={sw}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ filter: 'blur(5px)', opacity: 0.3 }}
        />
        <text x={cx} y={cx - (small ? 4 : 5)} textAnchor="middle" fill={color}
          fontSize={small ? 18 : 28} fontWeight="700" fontFamily="JetBrains Mono, monospace">
          {score != null ? score.toFixed(0) : '—'}
        </text>
        <text x={cx} y={cx + (small ? 10 : 13)} textAnchor="middle" fill="#52526b"
          fontSize={small ? 9 : 11} fontFamily="Inter, sans-serif">
          /100
        </text>
      </svg>
      <span style={{
        fontSize: small ? '10px' : '12px', fontWeight: 600, color,
        background: `${color}18`, borderRadius: '20px',
        padding: small ? '2px 8px' : '3px 12px', letterSpacing: '0.03em',
      }}>
        {label}
      </span>
      {!small && (
        <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          Health Score
        </span>
      )}
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────
function Section({ title, children, noPad }: { title: string; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      marginBottom: '16px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <span style={{ width: '3px', height: '16px', background: 'var(--gold)', borderRadius: '2px', display: 'inline-block', flexShrink: 0 }} />
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', color: 'var(--text-1)', letterSpacing: '0.01em', margin: 0 }}>
          {title}
        </h2>
      </div>
      <div style={noPad ? {} : { padding: '20px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = 'var(--gold)' }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, var(--surface) 60%, ${accent}08 100%)`,
      border: '1px solid var(--border)',
      borderTop: `2px solid ${accent}`,
      borderRadius: 'var(--radius)',
      padding: '18px 20px',
      flex: '1 1 160px',
      minWidth: 0,
    }}>
      <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '8px' }}>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, color: accent, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '5px' }}>{sub}</p>}
    </div>
  );
}

// ── Tooltips ───────────────────────────────────────────────────────────────────
const MoneyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
      <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: payload[0].color || 'var(--gold)', fontWeight: 600 }}>
        {fmt(payload[0].value)}
      </p>
    </div>
  );
};

const ScoreTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const score = payload[0].value;
  return (
    <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
      <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: healthColor(score), fontWeight: 600 }}>
        {score?.toFixed(1)} <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>/ 100</span>
      </p>
      <p style={{ fontSize: '11px', color: healthColor(score), marginTop: '2px' }}>{healthLabel(score)}</p>
    </div>
  );
};

const UnitsTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
      <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--green)', fontWeight: 600 }}>{payload[0].value} units</p>
    </div>
  );
};

const CatTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
      <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px' }}>{d.name}</p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: payload[0].fill, fontWeight: 600 }}>{fmt(d.value)}</p>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Carrefour() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/carrefour/purchases?count=500');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setPurchases(data.data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── All products from all purchases ───────────────────────────────────────
  const allProducts = useMemo(() =>
    purchases.flatMap(p => p.products), [purchases]);

  // ── Last purchase ─────────────────────────────────────────────────────────
  const lastPurchase = useMemo(() => {
    if (!purchases.length) return null;
    return [...purchases].sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return tb - ta;
    })[0];
  }, [purchases]);

  // ── Last purchase category breakdown (by product.category) ───────────────
  const lastPurchaseCategories = useMemo(() => {
    if (!lastPurchase) return [];
    const map: Record<string, number> = {};
    lastPurchase.products.forEach(p => {
      const sf = p.subFamily && /^\d+$/.test(p.subFamily.trim()) ? null : p.subFamily;
      const cat = p.category || sf || 'OTHER';
      map[cat] = (map[cat] || 0) + (p.netAmount || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100, color: categoryColor(name) }));
  }, [lastPurchase]);

  // ── Monthly spending ───────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map: Record<string, { spend: number; scores: number[]; count: number }> = {};
    purchases.forEach(p => {
      if (!p.date || !p.netAmount) return;
      const d = new Date(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { spend: 0, scores: [], count: 0 };
      map[key].spend += p.netAmount;
      map[key].count += 1;
      if (p.healthScore != null) map[key].scores.push(p.healthScore);
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => {
        const [y, m] = key.split('-');
        const label = new Date(+y, +m - 1).toLocaleString('es-ES', { month: 'short', year: '2-digit' });
        const avgScore = v.scores.length ? v.scores.reduce((a, b) => a + b, 0) / v.scores.length : null;
        return {
          month: label,
          spend: Math.round(v.spend * 100) / 100,
          count: v.count,
          healthScore: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
        };
      });
  }, [purchases]);

  // ── Category breakdown (all purchases, by product.category) ──────────────
  const categorySpendData = useMemo(() => {
    const map: Record<string, number> = {};
    allProducts.forEach(p => {
      // Skip numeric-only subFamily values (raw IDs, not real categories)
      const sf = p.subFamily && /^\d+$/.test(p.subFamily.trim()) ? null : p.subFamily;
      const cat = p.category || sf || 'Unknown';
      map[cat] = (map[cat] || 0) + (p.netAmount || 0);
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([name, value]) => ({
        name,
        value: Math.round(value * 100) / 100,
        pct: total > 0 ? (value / total) * 100 : 0,
        color: categoryColor(name),
      }));
  }, [allProducts]);

  // ── Product analytics ──────────────────────────────────────────────────────
  const byDesc = useMemo(() => {
    const map: Record<string, { totalSpend: number; totalUnits: number; unitPrices: number[] }> = {};
    allProducts.forEach(p => {
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
  }, [allProducts]);

  const topSpend = useMemo(() =>
    Object.entries(byDesc)
      .map(([name, d]) => ({ name, value: Math.round(d.totalSpend * 100) / 100 }))
      .sort((a, b) => b.value - a.value).slice(0, 10),
    [byDesc]);

  const topUnits = useMemo(() =>
    Object.entries(byDesc)
      .map(([name, d]) => ({ name, value: d.totalUnits }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value).slice(0, 10),
    [byDesc]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalSpend = purchases.reduce((s, p) => s + (p.netAmount || 0), 0);
    const avgSpend = purchases.length ? totalSpend / purchases.length : 0;
    const scoredPurchases = purchases.filter(p => p.healthScore != null);
    const avgHealth = scoredPurchases.length
      ? scoredPurchases.reduce((s, p) => s + (p.healthScore || 0), 0) / scoredPurchases.length
      : null;
    const uniqueProducts = Object.keys(byDesc).length;
    return { totalSpend, avgSpend, avgHealth, uniqueProducts };
  }, [purchases, byDesc]);

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="shimmer" style={{ flex: '1 1 160px', height: '88px', borderRadius: 'var(--radius)' }} />
        ))}
      </div>
      <div className="shimmer" style={{ height: '200px', borderRadius: 'var(--radius)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="shimmer" style={{ height: '220px', borderRadius: 'var(--radius)' }} />
        <div className="shimmer" style={{ height: '220px', borderRadius: 'var(--radius)' }} />
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: '60px', textAlign: 'center' }}>
      <p style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>Error: {error}</p>
    </div>
  );

  const axisStyle = { fontFamily: 'var(--font-mono)', fontSize: 11, fill: '#52526b' };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* ── STAT CARDS ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <StatCard
          label="Total Spend"
          value={fmt(stats.totalSpend)}
          sub={`${purchases.length} purchases`}
          accent="var(--gold)"
        />
        <StatCard
          label="Avg per Purchase"
          value={fmt(stats.avgSpend)}
          accent="var(--blue)"
        />
        <StatCard
          label="Unique Products"
          value={String(Object.keys(byDesc).length)}
          sub="distinct items"
          accent="var(--green)"
        />
        <StatCard
          label="Avg Health Score"
          value={stats.avgHealth != null ? stats.avgHealth.toFixed(1) : '—'}
          sub={stats.avgHealth != null ? healthLabel(stats.avgHealth) : 'no data'}
          accent={healthColor(stats.avgHealth)}
        />
      </div>

      {/* ── LAST PURCHASE HERO ───────────────────────────────────────────── */}
      {lastPurchase && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderTop: '2px solid var(--gold)',
          borderRadius: 'var(--radius)',
          marginBottom: '16px',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ width: '3px', height: '16px', background: 'var(--gold)', borderRadius: '2px', display: 'inline-block' }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', color: 'var(--text-1)', margin: 0 }}>
              Last Purchase
            </h2>
            {lastPurchase.date && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', marginLeft: 'auto' }}>
                {new Date(lastPurchase.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>

          {/* Body: left = ring + stats + pie, right = products list */}
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1px 1fr', gap: '0' }}>

            {/* Left: health score + totals + category donut */}
            <div style={{
              padding: '20px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
            }}>
              {/* Health score number + stats in a row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', justifyContent: 'center' }}>
                {/* Plain number display instead of ring */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
                    fontSize: '32px', lineHeight: 1,
                    color: healthColor(lastPurchase.healthScore),
                  }}>
                    {lastPurchase.healthScore != null ? `${lastPurchase.healthScore.toFixed(0)}%` : '—'}
                  </span>
                  <span style={{
                    fontSize: '11px', fontWeight: 600,
                    color: healthColor(lastPurchase.healthScore),
                    background: `${healthColor(lastPurchase.healthScore)}18`,
                    borderRadius: '20px', padding: '2px 10px',
                  }}>
                    {healthLabel(lastPurchase.healthScore)}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Health
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <p style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Total</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 600, color: 'var(--gold)' }}>
                      {lastPurchase.netAmount != null ? fmt(lastPurchase.netAmount) : '—'}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Items</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 600, color: 'var(--blue)' }}>
                      {lastPurchase.numberItems ?? lastPurchase.products.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Category donut */}
              {lastPurchaseCategories.length > 0 && (
                <div style={{ width: '100%' }}>
                  <p style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px', textAlign: 'center' }}>
                    Categories
                  </p>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={lastPurchaseCategories}
                        cx="50%" cy="50%"
                        innerRadius={38} outerRadius={62}
                        paddingAngle={2} dataKey="value" strokeWidth={0}
                      >
                        {lastPurchaseCategories.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CatTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {lastPurchaseCategories.slice(0, 5).map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: d.color }}>{fmt(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ background: 'var(--border)' }} />

            {/* Right: full product list */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 110px 90px 50px 80px',
                padding: '10px 20px', gap: '12px',
                borderBottom: '1px solid var(--border)',
              }}>
                {['Product', 'Category', 'Health', 'Units', 'Price'].map(h => (
                  <span key={h} style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                    {h}
                  </span>
                ))}
              </div>

              {/* Scrollable rows */}
              <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {[...lastPurchase.products]
                  .sort((a, b) => (b.netAmount || 0) - (a.netAmount || 0))
                  .map((p, i) => {
                    const cat = p.category;
                    const catColor = categoryColor(cat);
                    const hs = p.healthScore?.total_score ?? null;
                    const hsColor = healthColor(hs);
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'grid', gridTemplateColumns: '1fr 110px 90px 50px 80px',
                          padding: '9px 20px', gap: '12px',
                          borderBottom: '1px solid var(--border)',
                          alignItems: 'center',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontSize: '13px', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.description || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Unknown</span>}
                        </span>

                        <span>
                          {cat ? (
                            <span style={{
                              display: 'inline-block', fontSize: '11px', fontWeight: 500,
                              padding: '2px 8px', borderRadius: '20px',
                              background: `${catColor}18`, color: catColor,
                              maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {cat}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>—</span>
                          )}
                        </span>

                        {/* Per-product health score */}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {hs != null ? (
                            <>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: hsColor }}>
                                {hs.toFixed(0)}
                              </span>
                              <span style={{
                                fontSize: '10px', color: hsColor,
                                background: `${hsColor}18`, borderRadius: '10px',
                                padding: '1px 6px', fontWeight: 500,
                              }}>
                                {healthLabel(hs)}
                              </span>
                            </>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>—</span>
                          )}
                        </span>

                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)' }}>
                          {p.numberUnits ?? '—'}
                        </span>

                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--gold)', textAlign: 'right' }}>
                          {p.netAmount != null ? fmt(p.netAmount) : '—'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MONTHLY OVERVIEW ─────────────────────────────────────────────── */}
      {monthlyData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>

          {/* Monthly spending */}
          <Section title="Monthly Spending">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f0b429" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#f0b429" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={55} />
                <Tooltip content={<MoneyTooltip />} cursor={{ stroke: 'rgba(240,180,41,0.2)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="spend"
                  stroke="#f0b429" strokeWidth={2} fill="url(#spendGrad)"
                  dot={{ fill: '#f0b429', r: 3, strokeWidth: 0 }}
                  activeDot={{ fill: '#f0b429', r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Section>

          {/* Health score trend */}
          {monthlyData.some(d => d.healthScore != null) && (
            <Section title="Health Score Trend">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ade80" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} width={40} />
                  <Tooltip content={<ScoreTooltip />} cursor={{ stroke: 'rgba(74,222,128,0.2)', strokeWidth: 1 }} />
                  <Line
                    type="monotone" dataKey="healthScore"
                    stroke="#4ade80" strokeWidth={2}
                    dot={{ fill: '#4ade80', r: 4, strokeWidth: 0 }}
                    activeDot={{ fill: '#4ade80', r: 6, strokeWidth: 0 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}
        </div>
      )}

      {/* ── CATEGORY BREAKDOWN ───────────────────────────────────────────── */}
      {categorySpendData.length > 0 && (
        <Section title="Spending by Category">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {categorySpendData.map(d => (
              <div key={d.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-1)' }}>{d.name}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)' }}>
                    {d.pct.toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${d.pct}%`, height: '100%',
                    background: d.color, borderRadius: '3px',
                    transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── PRODUCT ANALYTICS ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

        {topSpend.length > 0 && (
          <Section title="Top Products by Spend" noPad>
            <div style={{ padding: '4px 16px 16px' }}>
              <ResponsiveContainer width="100%" height={Math.max(200, topSpend.length * 38)}>
                <BarChart data={topSpend} layout="vertical" barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} axisLine={false} tickLine={false} width={130} tickFormatter={n => truncate(n, 18)} />
                  <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {topSpend.map((_, i) => (
                      <Cell key={i} fill={`rgba(240,180,41,${0.95 - i * 0.07})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}

        {topUnits.length > 0 && (
          <Section title="Most Purchased (units)" noPad>
            <div style={{ padding: '4px 16px 16px' }}>
              <ResponsiveContainer width="100%" height={Math.max(200, topUnits.length * 38)}>
                <BarChart data={topUnits} layout="vertical" barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} axisLine={false} tickLine={false} width={130} tickFormatter={n => truncate(n, 18)} />
                  <Tooltip content={<UnitsTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {topUnits.map((_, i) => (
                      <Cell key={i} fill={`rgba(74,222,128,${0.95 - i * 0.07})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
