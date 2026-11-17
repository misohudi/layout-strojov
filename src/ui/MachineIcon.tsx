/** Machining centre (enclosure with spindle, control panel); with `staffed` an operator stands at the panel. */
export function MachineIcon({ staffed }: { staffed: boolean }) {
  return (
    <svg
      className="tile__icon"
      viewBox="0 0 64 64"
      fill="currentColor"
      aria-hidden="true"
      data-testid={staffed ? 'icon-staffed' : 'icon-machine'}
    >
      <g transform={staffed ? 'translate(-5 0)' : undefined}>
        {/* spindle head on top */}
        <rect x="21" y="3" width="16" height="9" rx="2" />
        {/* enclosure with the door window */}
        <path
          fillRule="evenodd"
          d="M12 10h32a4 4 0 0 1 4 4v42H8V14a4 4 0 0 1 4-4zM14 17v26h28V17z"
        />
        {/* spindle, tool, vise and table inside the window */}
        <rect x="25" y="17" width="6" height="11" />
        <path d="M26 28h4l-2 6z" />
        <rect x="22" y="35" width="12" height="3" />
        <rect x="17" y="39" width="22" height="2.5" />
        {/* feet */}
        <rect x="10" y="56" width="7" height="3" />
        <rect x="39" y="56" width="7" height="3" />
        {/* control panel on an arm */}
        <rect x="48" y="23" width="4" height="3" />
        <path fillRule="evenodd" d="M52 15h9a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V17a2 2 0 0 1 2-2zM53 18v7h7v-7z" />
      </g>
      {staffed && (
        <g>
          {/* operator standing at the panel */}
          <circle cx="54" cy="38.5" r="4.5" />
          <path d="M45.5 63V52c0-4.5 3.5-7.5 8.5-7.5s8.5 3 8.5 7.5v11z" />
        </g>
      )}
    </svg>
  );
}
