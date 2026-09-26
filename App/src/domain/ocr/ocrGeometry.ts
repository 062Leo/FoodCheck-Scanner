export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropRegion {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * Converts a rectangle drawn on a photo that is shown with `resizeMode="contain"`
 * (letter-boxed, one scale factor, centred) into pixel coordinates of the photo.
 * Returns null if the selection is too small or lies outside the photo.
 */
export function mapSelectionToImage(
  selection: Rect,
  view: Size,
  image: Size,
  minSize = 20
): CropRegion | null {
  if (image.width <= 0 || image.height <= 0 || view.width <= 0 || view.height <= 0) return null;

  const scale = Math.min(view.width / image.width, view.height / image.height);
  const offsetX = (view.width - image.width * scale) / 2;
  const offsetY = (view.height - image.height * scale) / 2;

  const left = Math.max(0, (selection.x - offsetX) / scale);
  const top = Math.max(0, (selection.y - offsetY) / scale);
  const right = Math.min(image.width, (selection.x + selection.width - offsetX) / scale);
  const bottom = Math.min(image.height, (selection.y + selection.height - offsetY) / scale);

  const width = Math.round(right - left);
  const height = Math.round(bottom - top);
  if (width < minSize || height < minSize) return null;

  return { originX: Math.round(left), originY: Math.round(top), width, height };
}

/**
 * Turns recognised label text into one ingredient paragraph: a word split by a line-end
 * hyphen is joined ("Zu-⏎cker" → "Zucker"), a hyphen before a capitalised continuation
 * is kept ("Glukose-⏎Fruktose" → "Glukose-Fruktose"), other line breaks become spaces.
 */
export function normalizeIngredientsOcrText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')
    .replace(/(\p{L})-\n(\p{Lu})/gu, '$1-$2')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
