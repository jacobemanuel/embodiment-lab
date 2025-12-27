export type SlideLookup = {
  byId: Map<string, { id: string; title: string }>;
  byTitle: Map<string, { id: string; title: string }>;
};

const normalizeTitleKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildSlideLookup = (slides: Array<{ slide_id: string; title: string }>): SlideLookup => {
  const byId = new Map<string, { id: string; title: string }>();
  const byTitle = new Map<string, { id: string; title: string }>();

  slides.forEach((slide) => {
    if (!slide?.slide_id) return;
    const title = slide.title || slide.slide_id;
    byId.set(slide.slide_id, { id: slide.slide_id, title });
    const titleKey = normalizeTitleKey(title);
    if (titleKey && !byTitle.has(titleKey)) {
      byTitle.set(titleKey, { id: slide.slide_id, title });
    }
  });

  return { byId, byTitle };
};

export const resolveSlideKey = (
  slideId?: string | null,
  slideTitle?: string | null,
  lookup?: SlideLookup
) => {
  const rawId = (slideId || '').trim();
  const rawTitle = (slideTitle || rawId).trim();
  const titleKey = normalizeTitleKey(rawTitle);

  if (lookup?.byId.has(rawId)) {
    const info = lookup.byId.get(rawId)!;
    return { key: info.id, title: info.title };
  }

  if (titleKey && lookup?.byTitle.has(titleKey)) {
    const info = lookup.byTitle.get(titleKey)!;
    return { key: info.id, title: info.title };
  }

  return { key: titleKey || rawId, title: rawTitle || rawId };
};
