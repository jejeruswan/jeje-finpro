import type { IconProps } from './types';
import { Edit } from './Edit';
import { InteractionNode } from './InteractionNode';
import { ViewfinderReticle } from './ViewfinderReticle';

export type { IconProps } from './types';

// Per-icon named components — best autocomplete + tree-shaking.
//   import { Edit } from '@/assets/icons';
//   <Edit size={24} color="var(--color-icon-primary)" />
export { Edit, InteractionNode, ViewfinderReticle };

// Name-based lookup — for rendering icons dynamically from data.
//   <Icon name="edit" />
export const iconMap = {
  edit: Edit,
  'interaction-node': InteractionNode,
  'viewfinder-reticle': ViewfinderReticle,
} as const;

export type IconName = keyof typeof iconMap;

export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  const Glyph = iconMap[name];
  return <Glyph {...props} />;
}
