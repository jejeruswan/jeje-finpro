import type { TimelineResizerProps } from '../useResizableTimeline';

/**
 * The drag handle sitting between the video preview and the timeline. Purely
 * presentational — all the resize behaviour lives in `useResizableTimeline`,
 * whose `resizerProps` are spread straight onto this component.
 */
export function TimelineResizer({ isResizing, ...rest }: TimelineResizerProps) {
  return (
    <div className="anim-resizer" data-resizing={isResizing || undefined} {...rest}>
      <span className="anim-resizer__grip" aria-hidden="true" />
    </div>
  );
}
