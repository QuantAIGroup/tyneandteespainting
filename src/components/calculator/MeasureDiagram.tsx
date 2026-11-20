/** Simple drawings showing customers where to measure. */

export function RoomDiagram() {
  return (
    <svg viewBox="0 0 360 230" className="h-auto w-full" role="img" aria-labelledby="room-diagram-title">
      <title id="room-diagram-title">Diagram of a room showing length and width along the floor and wall height from floor to ceiling</title>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10z" fill="#0012DA" />
        </marker>
      </defs>
      {/* back wall */}
      <path d="M90 30 L270 30 L270 150 L90 150 Z" fill="#F5F5F5" stroke="#000000" strokeWidth="1.5" />
      {/* left wall */}
      <path d="M30 70 L90 30 L90 150 L30 200 Z" fill="#E5E5E5" stroke="#000000" strokeWidth="1.5" />
      {/* right wall */}
      <path d="M270 30 L330 70 L330 200 L270 150 Z" fill="#E5E5E5" stroke="#000000" strokeWidth="1.5" />
      {/* floor */}
      <path d="M30 200 L90 150 L270 150 L330 200 Z" fill="#FFFFFF" stroke="#000000" strokeWidth="1.5" />
      {/* skirting */}
      <path d="M90 150 L270 150" stroke="#ffffff" strokeWidth="5" />
      <path d="M90 150 L270 150" stroke="#000000" strokeWidth="1" />
      {/* door */}
      <path d="M290 170 L290 92 L315 105 L315 186" fill="#ffffff" stroke="#5f5f5f" strokeWidth="1.2" />
      {/* length arrow along back wall floor */}
      <line x1="96" y1="162" x2="264" y2="162" stroke="#0012DA" strokeWidth="2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      <rect x="148" y="166" width="64" height="18" rx="4" fill="#000000" />
      <text x="180" y="179" textAnchor="middle" fontSize="11" fontFamily="sans-serif" fill="#ffffff" fontWeight="600">
        LENGTH
      </text>
      {/* width arrow along left floor edge */}
      <line x1="44" y1="200" x2="92" y2="160" stroke="#0012DA" strokeWidth="2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      <rect x="20" y="205" width="58" height="18" rx="4" fill="#000000" />
      <text x="49" y="218" textAnchor="middle" fontSize="11" fontFamily="sans-serif" fill="#ffffff" fontWeight="600">
        WIDTH
      </text>
      {/* height arrow on back wall */}
      <line x1="110" y1="36" x2="110" y2="144" stroke="#0012DA" strokeWidth="2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      <rect x="116" y="80" width="62" height="18" rx="4" fill="#000000" />
      <text x="147" y="93" textAnchor="middle" fontSize="11" fontFamily="sans-serif" fill="#ffffff" fontWeight="600">
        HEIGHT
      </text>
    </svg>
  );
}

export function SkirtingDiagram() {
  return (
    <svg viewBox="0 0 360 150" className="h-auto w-full" role="img" aria-labelledby="skirting-diagram-title">
      <title id="skirting-diagram-title">Diagram of a room seen from above, with the skirting measured all the way around the edge and the doorway left out</title>
      <defs>
        <marker id="arrow2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10z" fill="#0012DA" />
        </marker>
      </defs>
      <rect x="40" y="15" width="280" height="120" fill="#FFFFFF" stroke="#E5E5E5" strokeWidth="10" />
      <path d="M45 20 L315 20 L315 130 L210 130 M160 130 L45 130 L45 20" fill="none" stroke="#0012DA" strokeWidth="3" strokeDasharray="7 5" />
      <path d="M160 140 Q160 112 188 112" fill="none" stroke="#5f5f5f" strokeWidth="1.2" />
      <text x="185" y="148" textAnchor="middle" fontSize="10" fontFamily="sans-serif" fill="#5f5f5f">
        doorway – not included
      </text>
      <text x="180" y="78" textAnchor="middle" fontSize="12" fontFamily="sans-serif" fill="#000000" fontWeight="600">
        Add up every wall&apos;s skirting
      </text>
    </svg>
  );
}
