import { workbench } from '../theme';

export type GlyphName =
  | 'dashboard'
  | 'facility'
  | 'rooms'
  | 'cycles'
  | 'workflows'
  | 'workspace'
  | 'compliance'
  | 'harvests'
  | 'operations'
  | 'reports'
  | 'coach'
  | 'manual'
  | 'sop'
  | 'settings'
  | 'access'
  | 'more';

export function NavGlyph({ name }: { name: GlyphName }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <GlyphPath name={name} />
    </svg>
  );
}

function GlyphPath({ name }: { name: GlyphName }) {
  const stroke = 'currentColor';
  const common = { stroke, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'dashboard') {
    return (
      <>
        <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6" {...common} />
        <rect x="13" y="3.5" width="7.5" height="5" rx="1.6" {...common} />
        <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6" {...common} />
        <rect x="13" y="10.5" width="7.5" height="10" rx="1.6" {...common} />
      </>
    );
  }
  if (name === 'facility') {
    return (
      <>
        <path d="M4 20V9.5L12 4l8 5.5V20" {...common} />
        <path d="M9 20v-5h6v5" {...common} />
      </>
    );
  }
  if (name === 'rooms') {
    return (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" {...common} />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" {...common} />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" {...common} />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" {...common} />
      </>
    );
  }
  if (name === 'cycles') {
    return (
      <>
        <path d="M19 8a7 7 0 1 0 1.2 6" {...common} />
        <path d="M19 4v4h-4" {...common} />
      </>
    );
  }
  if (name === 'workflows') {
    return (
      <>
        <path d="M8 6h11M8 12h11M8 18h11" {...common} />
        <circle cx="4.5" cy="6" r="1.2" fill="currentColor" />
        <circle cx="4.5" cy="12" r="1.2" fill="currentColor" />
        <circle cx="4.5" cy="18" r="1.2" fill="currentColor" />
      </>
    );
  }
  if (name === 'workspace') {
    return (
      <>
        <circle cx="12" cy="8" r="3" {...common} />
        <path d="M5 19.5c1.4-3 3.8-4.5 7-4.5s5.6 1.5 7 4.5" {...common} />
      </>
    );
  }
  if (name === 'compliance') {
    return <path d="M12 3.5 19 6.5v5.2c0 4.2-2.8 7.2-7 8.8-4.2-1.6-7-4.6-7-8.8V6.5L12 3.5Z" {...common} />;
  }
  if (name === 'harvests') {
    return (
      <>
        <path d="M12 20V9" {...common} />
        <path d="M12 14c-3.2-.2-5.2-2.2-6-5 3.2.2 5.2 2.2 6 5Z" {...common} />
        <path d="M12 12c3-.4 5-2.2 5.8-4.8-3 .2-5 2-5.8 4.8Z" {...common} />
      </>
    );
  }
  if (name === 'operations') {
    return (
      <>
        <circle cx="12" cy="12" r="3" {...common} />
        <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" {...common} />
      </>
    );
  }
  if (name === 'reports') {
    return (
      <>
        <path d="M4 19V5M4 19h16" {...common} />
        <path d="M8 15v-4M12 15V8M16 15v-6" {...common} />
      </>
    );
  }
  if (name === 'coach') {
    return (
      <>
        <path d="M5 7.5h10.5a3 3 0 0 1 3 3V17a2 2 0 0 1-2 2H7.5" {...common} />
        <path d="M5 7.5V17a2 2 0 0 0 2 2h1.5" {...common} />
        <path d="M8.5 11h6M8.5 14.5h4" {...common} />
      </>
    );
  }
  if (name === 'manual') {
    return (
      <>
        <path d="M5 5.5h6.2A2.8 2.8 0 0 1 14 8.3V19a2.2 2.2 0 0 0-2.2-1.6H5V5.5Z" {...common} />
        <path d="M19 5.5h-6.2A2.8 2.8 0 0 0 10 8.3V19a2.2 2.2 0 0 1 2.2-1.6H19V5.5Z" {...common} />
      </>
    );
  }
  if (name === 'sop') {
    return (
      <>
        <rect x="6" y="3.5" width="12" height="17" rx="2" {...common} />
        <path d="M9 8h6M9 12h6M9 16h4" {...common} />
      </>
    );
  }
  if (name === 'settings') {
    return (
      <>
        <circle cx="12" cy="12" r="3" {...common} />
        <path d="M12 4.2 13.1 6l2.1-.4 1 1.8-.8 2 1.6 1.4v2.2l-1.6 1.4.8 2-1 1.8-2.1-.4L12 19.8 10.9 18l-2.1.4-1-1.8.8-2L7 13.2v-2.2l1.6-1.4-.8-2 1-1.8 2.1.4L12 4.2Z" {...common} />
      </>
    );
  }
  if (name === 'access') {
    return (
      <>
        <circle cx="8" cy="10" r="3" {...common} />
        <path d="M11 12.2 20 8.5l1.2 2.2-2 1-.8 1.6 1.6.6-1.2 2.1-1.8-.7-.8 1.5H14l-.6-2.2" {...common} />
      </>
    );
  }
  return (
    <>
      <circle cx="6" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18" cy="12" r="1.3" fill="currentColor" />
    </>
  );
}

export function CanopyScene() {
  return (
    <svg viewBox="0 0 640 280" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Greenhouse canopy">
      <rect width="640" height="280" rx="28" fill="#120A28" />
      <circle cx="86" cy="54" r="4" fill={workbench.sky} />
      <circle cx="140" cy="36" r="3" fill={workbench.gold} />
      <circle cx="210" cy="58" r="3" fill="#fff" opacity="0.8" />
      <circle cx="520" cy="64" r="36" fill={workbench.gold} />
      <circle cx="500" cy="52" r="28" fill="#FF8A3D" opacity="0.85" />
      <path d="M0 196c80-48 140-48 210 0s130 48 210 0 140-36 220 8v76H0V196Z" fill="#5B2BE0" />
      <path d="M0 220c90-30 150-20 230 10s140 28 220-8 120-24 190 6v52H0V220Z" fill="#FF4F8B" />
      <g stroke={workbench.sky} strokeWidth="3" fill="none">
        <path d="M150 210 V78 h150 v132" />
        <path d="M150 112 h150M150 150 h150M188 78 v132M226 78 v132M264 78 v132" />
        <path d="M150 78 225 42 300 78" />
      </g>
      <g fill={workbench.greenhouse}>
        <ellipse cx="188" cy="168" rx="16" ry="28" />
        <ellipse cx="226" cy="160" rx="18" ry="34" />
        <ellipse cx="264" cy="170" rx="15" ry="26" />
      </g>
      <g fill={workbench.gold}>
        <circle cx="188" cy="146" r="7" />
        <circle cx="230" cy="134" r="8" />
        <circle cx="262" cy="150" r="6" />
      </g>
      <rect x="390" y="150" width="70" height="70" rx="16" fill={workbench.violet} />
      <rect x="476" y="126" width="54" height="94" rx="16" fill={workbench.sky} />
      <rect x="546" y="164" width="48" height="56" rx="14" fill={workbench.copper} />
    </svg>
  );
}

export function RoomGlyph({ color }: { color: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <rect width="36" height="36" rx="12" fill={color} />
      <path d="M18 27V14" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 20c-4-.3-6.4-2.6-7.2-6 4 .2 6.4 2.5 7.2 6Z" fill="#fff" />
      <path d="M18 18c3.6-.4 6-2.4 7-5.6-3.6.2-6 2.2-7 5.6Z" fill="#fff" opacity="0.85" />
    </svg>
  );
}
