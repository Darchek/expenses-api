'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
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

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: '🍽️', transport: '⛽', grocery: '🛒',
  entertainment: '🎬', health: '💊', shopping: '🛍️',
  travel: '✈️', utilities: '💡',
};

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#f97316', transport: '#60a5fa', grocery: '#4ade80',
  entertainment: '#c084fc', health: '#f472b6', shopping: '#fbbf24',
  travel: '#22d3ee', utilities: '#94a3b8', other: '#6b7280',
};

const fmt = (n: number, currency = '€') =>
  `${currency}${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 500, color: 'var(--gold)', lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '6px' }}>{sub}</p>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
      borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '13px',
    }}>
      <p style={{ color: 'var(--text-2)', marginBottom: '4px', fontFamily: 'var(--font-display)', fontSize: '12px' }}>{label}</p>
      <p style={{ color: 'var(--gold)', fontWeight: 600 }}>{fmt(payload[0].value)}</p>
    </div>
  );
};

const HBarTooltip = ({ active, payload, label }: any) => {
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

const PAGE_SIZE = 50;

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/expenses?limit=1000');
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
    const last12 = sorted.slice(-12);
    return last12.map(([k, v]) => {
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
      .slice(0, 10)
      .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }));
  }, [expenses]);

  // Paginated list
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
        <StatCard label="Total spent" value={fmt(stats.total, stats.currency)} sub={`${stats.count} transactions`} />
        <StatCard label="This month" value={fmt(stats.month, stats.currency)} />
        <StatCard label="Avg. transaction" value={fmt(stats.avg, stats.currency)} />
        <StatCard label="Top shop" value={shopData[0]?.name || '—'} sub={shopData[0] ? fmt(shopData[0].total, stats.currency) : undefined} />
      </div>

      {/* ── MONTHLY CHART ──────────────────────────────────────────────── */}
      {monthlyData.length > 0 && (
        <Section title="Monthly Spending">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false}
                tickFormatter={v => `${stats.currency}${v}`} width={60} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(232,168,32,0.06)' }} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="#e8a820">
                {monthlyData.map((_, i) => (
                  <Cell key={i}
                    fill={i === monthlyData.length - 1 ? '#e8a820' : 'rgba(232,168,32,0.55)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* ── CHARTS ROW ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>

        {/* Category breakdown */}
        {categoryData.length > 0 && (
          <Section title="By Category" noPad>
            <div style={{ padding: '0 16px 16px' }}>
              <ResponsiveContainer width="100%" height={Math.max(180, categoryData.length * 36)}>
                <BarChart data={categoryData} layout="vertical" barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false}
                    tickFormatter={v => `${stats.currency}${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 12 }}
                    axisLine={false} tickLine={false} width={90}
                    tickFormatter={n => `${CATEGORY_EMOJI[n] || '💳'} ${n}`} />
                  <Tooltip content={<HBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {categoryData.map((d, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[d.name] || CATEGORY_COLORS.other} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}

        {/* Top shops */}
        {shopData.length > 0 && (
          <Section title="Top Shops" noPad>
            <div style={{ padding: '0 16px 16px' }}>
              <ResponsiveContainer width="100%" height={Math.max(180, shopData.length * 36)}>
                <BarChart data={shopData} layout="vertical" barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false}
                    tickFormatter={v => `${stats.currency}${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 12 }}
                    axisLine={false} tickLine={false} width={110}
                    tickFormatter={n => n.length > 14 ? n.slice(0, 13) + '…' : n} />
                  <Tooltip content={<HBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="total" fill="rgba(232,168,32,0.7)" radius={[0, 4, 4, 0]}>
                    {shopData.map((_, i) => (
                      <Cell key={i}
                        fill={`rgba(232,168,32,${0.9 - i * 0.07})`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}
      </div>

      {/* ── EXPENSE LIST ───────────────────────────────────────────────── */}
      <Section title={`All Expenses (${sorted.length})`} noPad>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr 130px 110px',
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          gap: '12px',
        }}>
          {['Date', 'Shop', 'Category', 'Amount'].map(h => (
            <span key={h} style={{
              fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
              color: 'var(--text-3)', textTransform: 'uppercase',
            }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {pageData.map((e, i) => (
          <div key={e.id} style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr 130px 110px',
            padding: '12px 20px',
            gap: '12px',
            borderBottom: '1px solid var(--border)',
            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
            alignItems: 'center',
            transition: 'background 0.1s',
          }}
            onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={ev => (ev.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-2)' }}>
              {e.postTime ? new Date(e.postTime).toLocaleDateString('es-ES', {
                day: '2-digit', month: 'short', year: 'numeric',
              }) : '—'}
            </span>

            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 500,
              fontSize: '14px', color: 'var(--text-1)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {e.shopName || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Unknown</span>}
            </span>

            <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>
              {e.category ? (
                <span>
                  {CATEGORY_EMOJI[e.category] || '💳'}{' '}
                  <span style={{ color: CATEGORY_COLORS[e.category] || 'var(--text-2)' }}>
                    {e.category}
                  </span>
                </span>
              ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
            </span>

            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 600,
              fontSize: '14px', color: 'var(--gold)',
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
            padding: '14px 20px', borderTop: '1px solid var(--border)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)' }}>
              Page {page + 1} of {pageCount} · {sorted.length} total
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { label: '← Prev', disabled: page === 0, action: () => setPage(p => Math.max(0, p - 1)) },
                { label: 'Next →', disabled: page >= pageCount - 1, action: () => setPage(p => Math.min(pageCount - 1, p + 1)) },
              ].map(({ label, disabled, action }) => (
                <button key={label} onClick={action} disabled={disabled} style={{
                  fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600,
                  padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-strong)',
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
        <span style={{
          width: '3px', height: '16px', background: 'var(--gold)',
          borderRadius: '2px', display: 'inline-block',
        }} />
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: '14px', color: 'var(--text-1)',
          letterSpacing: '-0.2px', margin: 0,
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
