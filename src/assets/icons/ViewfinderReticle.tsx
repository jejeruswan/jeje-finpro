import type { IconProps } from './types';

/** The corkboard's "middle cursor" crosshair, exported from Figma
 *  (jess-mirage, node 555:98128). */
export function ViewfinderReticle({ size = 22, color, style, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={color ? { color, ...style } : style}
      {...rest}
    >
      <path d="M1 10.5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 1L11 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
