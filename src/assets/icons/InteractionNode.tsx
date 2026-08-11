import type { IconProps } from './types';

/**
 * The interaction glyph: a broken orbit with a small circle at each break —
 * the same "reaction wired to a script" idea the timeline's node connector
 * lines draw. Exported from the Figma inspector's left icon (node 476:90384).
 *
 * The artwork is authored in its natural 19.58 × 16.25 box; the design scales
 * it to ~18.2 × 15.1 and rotates it 16.44° inside a 20 × 20 icon frame, so the
 * group transform below reproduces that placement rather than re-drawing it.
 */
export function InteractionNode({ size = 24, color, style, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={color ? { color, ...style } : style}
      {...rest}
    >
      <g
        transform="rotate(16.44 10 10) translate(0.9 2.45) scale(0.93)"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="none"
      >
        <path
          d="M17.1875 8.125C17.1875 12.2671 13.8296 15.625 9.68746 15.625C8.79712 15.625 7.94301 15.4699 7.1507 15.1851M2.18746 8.125C2.18746 3.98286 5.54533 0.625 9.68746 0.625C10.661 0.625 11.5913 0.810508 12.4448 1.1481"
          strokeLinecap="round"
        />
        <circle cx="2.70833" cy="10.2083" r="2.08333" />
        <circle cx="16.8749" cy="6.04167" r="2.08333" />
      </g>
    </svg>
  );
}
