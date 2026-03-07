'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const path = usePathname();

  return (
    <nav style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '32px',
      height: '56px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: '17px',
        color: 'var(--gold)',
        letterSpacing: '-0.3px',
        marginRight: '8px',
      }}>
        ◈ EXPENSES
      </span>

      {[
        { href: '/', label: 'Dashboard' },
        { href: '/carrefour', label: 'Carrefour' },
        { href: '/map', label: 'Map' },
      ].map(({ href, label }) => {
        const active = path === href;
        return (
          <Link key={href} href={href} style={{
            fontFamily: 'var(--font-display)',
            fontWeight: active ? 600 : 400,
            fontSize: '14px',
            color: active ? 'var(--text-1)' : 'var(--text-2)',
            textDecoration: 'none',
            paddingBottom: '2px',
            borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
            transition: 'color 0.15s, border-color 0.15s',
          }}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
