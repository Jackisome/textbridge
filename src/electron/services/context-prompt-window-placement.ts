import type { PromptAnchor, PromptAnchorBounds } from '../../shared/types/context-prompt';

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResolveContextPromptWindowBoundsOptions {
  anchor: PromptAnchor;
  popupSize: { width: number; height: number };
  workArea: Rectangle;
  cursorPoint?: { x: number; y: number };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function placeBelowAnchor(
  anchorBounds: PromptAnchorBounds,
  popupWidth: number,
  popupHeight: number,
  workArea: Rectangle
): Rectangle {
  // Place directly below the anchor
  let x = anchorBounds.x;
  let y = anchorBounds.y + anchorBounds.height;

  // Clamp x so popup doesn't overflow right edge
  x = clamp(x, workArea.x, workArea.x + workArea.width - popupWidth);

  // If popup overflows bottom, flip to above anchor
  if (y + popupHeight > workArea.y + workArea.height) {
    y = anchorBounds.y - popupHeight;
    // Clamp again after flip
    y = clamp(y, workArea.y, workArea.y + workArea.height - popupHeight);
  }

  return { x, y, width: popupWidth, height: popupHeight };
}

function placeNearCursor(
  cursorPoint: { x: number; y: number },
  popupWidth: number,
  popupHeight: number,
  workArea: Rectangle
): Rectangle {
  // Offset cursor slightly to avoid cursor overlap
  const x = clamp(cursorPoint.x + 16, workArea.x, workArea.x + workArea.width - popupWidth);
  const y = clamp(cursorPoint.y + 16, workArea.y, workArea.y + workArea.height - popupHeight);
  return { x, y, width: popupWidth, height: popupHeight };
}

function placeCentered(
  popupWidth: number,
  popupHeight: number,
  workArea: Rectangle
): Rectangle {
  const x = (workArea.width - popupWidth) / 2;
  const y = (workArea.height - popupHeight) / 2;
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: popupWidth,
    height: popupHeight
  };
}

export function resolveContextPromptWindowBounds({
  anchor,
  popupSize,
  workArea,
  cursorPoint
}: ResolveContextPromptWindowBoundsOptions): Rectangle {
  const { width: popupWidth, height: popupHeight } = popupSize;

  // Clamp popup dimensions to work area
  const clampedHeight = Math.min(popupHeight, workArea.height);
  const clampedWidth = Math.min(popupWidth, workArea.width);

  switch (anchor.kind) {
    case 'control-rect':
    case 'selection-rect':
    case 'window-rect': {
      if (!anchor.bounds) {
        return placeCentered(clampedWidth, clampedHeight, workArea);
      }
      return placeBelowAnchor(anchor.bounds, clampedWidth, clampedHeight, workArea);
    }

    case 'cursor': {
      // cursor without a point falls back to centered
      if (!cursorPoint) {
        return placeCentered(clampedWidth, clampedHeight, workArea);
      }
      return placeNearCursor(cursorPoint, clampedWidth, clampedHeight, workArea);
    }

    case 'unknown':
    default:
      return placeCentered(clampedWidth, clampedHeight, workArea);
  }
}
