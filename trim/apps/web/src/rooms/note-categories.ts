import type { NoteCategory } from '@trim/contracts';

export const NOTE_CATEGORIES: { value: NoteCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'environment', label: 'Environment' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'canopy', label: 'Canopy' },
  { value: 'pests', label: 'Pests' },
  { value: 'nutrients', label: 'Nutrients' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'harvest', label: 'Harvest' },
];

export function noteCategoryLabel(category: string | null | undefined): string | null {
  if (!category) {
    return null;
  }
  return NOTE_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}
