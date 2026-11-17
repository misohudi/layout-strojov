/** Line icons drawn in the text colour (header, start screen, settings). */
export const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

/** Clock with an arrow turning back in time – history. */
export const HistoryIcon = () => (
  <svg {...svg} className="hicon">
    <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8.3" />
    <path d="M3 3.5v4.8h4.8" />
    <path d="M12 7.5V12l3.2 2" />
  </svg>
);

/** Gear – settings. */
export const GearIcon = () => (
  <svg {...svg} className="hicon">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/** Sun – light appearance. */
export const SunIcon = () => (
  <svg {...svg} className="hicon" data-testid="icon-theme-light">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

/** Moon – dark appearance. */
export const MoonIcon = () => (
  <svg {...svg} className="hicon" data-testid="icon-theme-dark">
    <path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z" />
  </svg>
);

/**
 * Half sun (rays on the left), half moon (filled right half) with an "A" inside – appearance
 * follows the device. The letter is cut out of the filled half, so it reads in both themes.
 */
export const AutoThemeIcon = ({ id }: { id: string }) => (
  <svg {...svg} className="hicon" data-testid="icon-theme-system">
    <defs>
      <mask id={id}>
        <rect x="0" y="0" width="24" height="24" fill="#fff" />
        <path d="M10.2 16.4L13 8.6l2.8 7.8M11.1 13.8h3.8" stroke="#000" strokeWidth="3.4" fill="none" />
      </mask>
    </defs>
    <circle cx="13" cy="12" r="7.6" />
    <path d="M13 4.4a7.6 7.6 0 0 1 0 15.2z" fill="currentColor" stroke="none" mask={`url(#${id})`} />
    <path d="M1.5 12h2M5.2 4.2l1.4 1.4M5.2 19.8l1.4-1.4" />
    <path d="M10.2 16.4L13 8.6l2.8 7.8M11.1 13.8h3.8" strokeWidth="1.8" />
  </svg>
);

/** Arrow pointing left – back. */
export const BackIcon = () => (
  <svg {...svg} className="hicon">
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
