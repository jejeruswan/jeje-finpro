import type { IconProps } from './types';

/** The Interaction inspector's title mark: two nodes joined by an orbit
 *  (jess-mirage, node 728:140414 "Left Icon"). */
export function InteractionOrbit({ size = 20, color, style, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 21 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={color ? { color, ...style } : style}
      {...rest}
    >
      <path
        d="M17.1975 12.0931C16.0251 16.0659 11.8542 18.3361 7.88142 17.1637C7.02749 16.9117 6.25221 16.5212 5.57288 16.0238M2.81085 7.84762C3.98321 3.87486 8.15416 1.60468 12.1269 2.77704C13.0607 3.0526 13.9004 3.49382 14.6235 4.05918"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <circle cx="2.72099" cy="9.99307" r="2.08333" transform="rotate(16.4413 2.72099 9.99307)" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="17.4876" cy="10.0067" r="2.08333" transform="rotate(16.4413 17.4876 10.0067)" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
