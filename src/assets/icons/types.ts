import type { SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'color'> {
  /** Width & height in px (icons are square). Defaults to 24. */
  size?: number | string;
  /**
   * Icon color. Applied via CSS `color`; the SVG strokes/fills use
   * `currentColor`, so you can also color icons purely from CSS.
   */
  color?: string;
}
