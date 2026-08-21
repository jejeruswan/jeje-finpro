import type { IconProps } from './types';
import { AttentionEye } from './AttentionEye';
import { CameraLens } from './CameraLens';
import { Edit } from './Edit';
import { InteractionNode } from './InteractionNode';
import { ViewfinderReticle } from './ViewfinderReticle';

export type { IconProps } from './types';

// Per-icon named components — best autocomplete + tree-shaking.
//   import { Edit } from '@/assets/icons';
//   <Edit size={24} color="var(--color-icon-primary)" />
export { AttentionEye, CameraLens, Edit, InteractionNode, ViewfinderReticle };
export { CursorAddBadge } from './CursorAddBadge';
export { ChatShine, DownloadTray, RedoArrow, SidebarPanel, UndoArrow } from './HeaderGlyphs';
export {
  ArrowRightThin,
  AvatarsAdd,
  ChevronDownSmall,
  CreateTemplate,
  EditBare,
  FolderAdd,
  HouseNav,
  InfoRing,
  PaperclipTilt,
  TipLamp,
} from './HomeGlyphs';
export { InteractionOrbit } from './InteractionOrbit';
export { AreaFlower, MarkGlyph } from './MarkGlyph';
export { ScriptScroll } from './ScriptScroll';

// Name-based lookup — for rendering icons dynamically from data.
//   <Icon name="edit" />
export const iconMap = {
  'attention-eye': AttentionEye,
  'camera-lens': CameraLens,
  edit: Edit,
  'interaction-node': InteractionNode,
  'viewfinder-reticle': ViewfinderReticle,
} as const;

export type IconName = keyof typeof iconMap;

export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  const Glyph = iconMap[name];
  return <Glyph {...props} />;
}
