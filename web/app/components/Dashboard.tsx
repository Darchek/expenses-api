'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts';

interface Expense {
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

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#f97316', transport: '#60a5fa', grocery: '#4ade80',
  entertainment: '#a78bfa', health: '#f472b6', shopping: '#fbbf24',
  travel: '#2dd4bf', utilities: '#94a3b8', other: '#52526b',
};

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: '🍽', transport: '⛽', grocery: '🛒',
  entertainment: '🎬', health: '💊', shopping: '🛍',
  travel: '✈', utilities: '💡',
};

const fmt = (n: number, currency = '€') =>
  `${currency}${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, var(--surface) 60%, ${accent}08 100%)`,
      border: `1px solid var(--border)`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 'var(--radius)',
      padding: '20px 22px',
      flex: '1 1 180px',
      minWidth: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80,
        borderRadius: '50%',
        background: `${accent}0a`,
      }} />
      <p style={{
        fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
        color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '10px',
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500,
        color: accent, lineHeight: 1, marginBottom: sub ? '6px' : 0,
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>{sub}</p>
      )}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
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
        <span style={{
          width: '3px', height: '16px',
          background: 'var(--gold)',
          borderRadius: '2px', display: 'inline-block',
          flexShrink: 0,
        }} />
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 600,
          fontSize: '13px', color: 'var(--text-1)',
          letterSpacing: '0.01em', margin: 0,
        }}>
          {title}
        </h2>
      </div>
      <div style={noPad ? {} : { padding: '20px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Tooltips ───────────────────────────────────────────────────────────────────
const MoneyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-3)', border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px',
    }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--gold)', fontWeight: 600 }}>
        {fmt(payload[0].value)}
      </p>
    </div>
  );
};

const CatTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const color = CATEGORY_COLORS[d.name] || '#6b7280';
  return (
    <div style={{
      background: 'var(--surface-3)', border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px',
    }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px' }}>
        {CATEGORY_EMOJI[d.name] || '💳'} {d.name}
      </p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color, fontWeight: 600 }}>
        {fmt(d.total)}
      </p>
    </div>
  );
};

const ShopTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-3)', border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px',
    }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--blue)', fontWeight: 600 }}>
        {fmt(payload[0].value)}
      </p>
    </div>
  );
};

const PAGE_SIZE = 50;

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/expenses?limit=1000');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setExpenses(data.data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── derived data ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!expenses.length) return { total: 0, month: 0, avg: 0, count: 0, currency: '€' };
    const valid = expenses.filter(e => e.amount && e.amount > 0);
    const total = valid.reduce((s, e) => s + (e.amount || 0), 0);
    const now = new Date();
    const monthExp = valid.filter(e => {
      if (!e.postTime) return false;
      const d = new Date(e.postTime);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const month = monthExp.reduce((s, e) => s + (e.amount || 0), 0);
    const avg = valid.length ? total / valid.length : 0;
    const currency = expenses.find(e => e.currency)?.currency || '€';
    return { total, month, avg, count: valid.length, currency };
  }, [expenses]);

  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      if (!e.postTime || !e.amount || e.amount <= 0) return;
      const d = new Date(e.postTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + e.amount;
    });
    const sorted = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.slice(-12).map(([k, v]) => {
      const [y, m] = k.split('-');
      const label = new Date(+y, +m - 1).toLocaleString('es-ES', { month: 'short', year: '2-digit' });
      return { month: label, total: Math.round(v * 100) / 100 };
    });
  }, [expenses]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      if (!e.amount || e.amount <= 0) return;
      const cat = e.category || 'other';
      map[cat] = (map[cat] || 0) + e.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }));
  }, [expenses]);

  const shopData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      if (!e.amount || e.amount <= 0 || !e.shopName) return;
      map[e.shopName] = (map[e.shopName] || 0) + e.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }));
  }, [expenses]);

  const sorted = useMemo(() =>
    [...expenses].sort((a, b) => {
      const ta = a.postTime ? new Date(a.postTime).getTime() : 0;
      const tb = b.postTime ? new Date(b.postTime).getTime() : 0;
      return tb - ta;
    }), [expenses]);

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── loading / error ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: '32px 24px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="shimmer" style={{ flex: '1 1 180px', height: '96px', borderRadius: 'var(--radius)' }} />
      ))}
      <div style={{ width: '100%' }}>
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

      {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <StatCard
          label="Total Spent"
          value={fmt(stats.total, stats.currency)}
          sub={`${stats.count} transactions`}
          accent="var(--gold)"
        />
        <StatCard
          label="This Month"
          value={fmt(stats.month, stats.currency)}
          accent="var(--blue)"
        />
        <StatCard
          label="Avg Transaction"
          value={fmt(stats.avg, stats.currency)}
          accent="var(--green)"
        />
        <StatCard
          label="Top Shop"
          value={shopData[0]?.name || '—'}
          sub={shopData[0] ? fmt(shopData[0].total, stats.currency) : undefined}
          accent="var(--purple)"
        />
      </div>

      {/* ── MONTHLY AREA CHART ──────────────────────────────────────────── */}
      {monthlyData.length > 0 && (
        <Section title="Monthly Spending">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="monthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f0b429" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#f0b429" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false}
                tickFormatter={v => `${stats.currency}${v}`} width={60} />
              <Tooltip content={<MoneyTooltip />} cursor={{ stroke: 'rgba(240,180,41,0.2)', strokeWidth: 1 }} />
              <Area
                type="monotone" dataKey="total"
                stroke="#f0b429" strokeWidth={2}
                fill="url(#monthGrad)"
                dot={{ fill: '#f0b429', r: 3, strokeWidth: 0 }}
                activeDot={{ fill: '#f0b429', r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* ── CHARTS ROW ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>

        {/* Category donut */}
        {categoryData.length > 0 && (
          <Section title="By Category">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={2}
                    dataKey="total"
                    strokeWidth={0}
                  >
                    {categoryData.map((d, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[d.name] || '#52526b'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CatTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {categoryData.slice(0, 6).map(d => {
                  const color = CATEGORY_COLORS[d.name] || '#52526b';
                  const pct = stats.total > 0 ? ((d.total / stats.total) * 100).toFixed(1) : '0';
                  return (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-2)' }}>
                        {CATEGORY_EMOJI[d.name] || '💳'} {d.name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>{pct}%</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color, minWidth: 60, textAlign: 'right' }}>
                        {fmt(d.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>
        )}

        {/* Top shops */}
        {shopData.length > 0 && (
          <Section title="Top Shops" noPad>
            <div style={{ padding: '4px 16px 16px' }}>
              <ResponsiveContainer width="100%" height={Math.max(180, shopData.length * 36)}>
                <BarChart data={shopData} layout="vertical" barCategoryGap="25%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false}
                    tickFormatter={v => `${stats.currency}${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 12 }}
                    axisLine={false} tickLine={false} width={110}
                    tickFormatter={n => n.length > 14 ? n.slice(0, 13) + '…' : n} />
                  <Tooltip content={<ShopTooltip />} cursor={{ fill: 'rgba(96,165,250,0.05)' }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {shopData.map((_, i) => (
                      <Cell key={i} fill={`rgba(96,165,250,${0.9 - i * 0.08})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}
      </div>

      {/* ── EXPENSE TABLE ──────────────────────────────────────────────── */}
      <Section title={`All Expenses  ·  ${sorted.length} transactions`} noPad>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '130px 1fr 120px 100px',
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          gap: '12px',
        }}>
          {['Date', 'Shop', 'Category', 'Amount'].map(h => (
            <span key={h} style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
              color: 'var(--text-3)', textTransform: 'uppercase',
            }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {pageData.map((e, i) => (
          <div
            key={e.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '130px 1fr 120px 100px',
              padding: '11px 20px',
              gap: '12px',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
              cursor: 'default',
              transition: 'background 0.1s',
            }}
            onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
              {e.postTime ? new Date(e.postTime).toLocaleDateString('es-ES', {
                day: '2-digit', month: 'short', year: 'numeric',
              }) : '—'}
            </span>

            <span style={{
              fontSize: '13px', fontWeight: 500, color: 'var(--text-1)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {e.shopName || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Unknown</span>}
            </span>

            <span style={{ fontSize: '12px' }}>
              {e.category ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '2px 8px', borderRadius: '20px',
                  background: `${CATEGORY_COLORS[e.category] || '#52526b'}18`,
                  color: CATEGORY_COLORS[e.category] || 'var(--text-3)',
                  fontSize: '11px', fontWeight: 500,
                }}>
                  {CATEGORY_EMOJI[e.category] || '💳'} {e.category}
                </span>
              ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
            </span>

            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 600,
              fontSize: '13px', color: 'var(--gold)',
              textAlign: 'right',
            }}>
              {e.amount != null ? fmt(e.amount, e.currency || '€') : '—'}
            </span>
          </div>
        ))}

        {/* Pagination */}
        {pageCount > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', borderTop: '1px solid var(--border)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
              {page + 1} / {pageCount} &nbsp;·&nbsp; {sorted.length} total
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { label: '← Prev', disabled: page === 0, action: () => setPage(p => Math.max(0, p - 1)) },
                { label: 'Next →', disabled: page >= pageCount - 1, action: () => setPage(p => Math.min(pageCount - 1, p + 1)) },
              ].map(({ label, disabled, action }) => (
                <button key={label} onClick={action} disabled={disabled} style={{
                  fontSize: '12px', fontWeight: 600, padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)',
                  background: disabled ? 'transparent' : 'var(--surface-2)',
                  color: disabled ? 'var(--text-3)' : 'var(--text-1)',
                  cursor: disabled ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
