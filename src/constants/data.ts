/**
 * DATA CONSTANTEN
 * Allergenen, eetmomenten en weekschema-slots — overgenomen
 * uit de webversie zodat alles consistent blijft.
 */

export const ALLERGENS = [
  'gluten', 'lactose', 'ei', 'noten', 'pinda',
  'soja', 'vis', 'schaaldieren', 'selderij',
  'mosterd', 'sesam', 'sulfiet', 'lupine',
];

export type MealMomentId = 'ochtend' | 'fruit moment' | 'middag' | 'snack' | 'avond';

export const MEAL_MOMENTS: { id: MealMomentId; label: string }[] = [
  { id: 'ochtend', label: 'Ochtend' },
  { id: 'fruit moment', label: 'Fruit Moment' },
  { id: 'middag', label: 'Middag' },
  { id: 'snack', label: 'Snack' },
  { id: 'avond', label: 'Avond' },
];

export type ScheduleSlotId = 'ochtend' | 'snack1' | 'middag' | 'snack2' | 'avond';

export const SCHEDULE_SLOTS: { id: ScheduleSlotId; label: string }[] = [
  { id: 'ochtend', label: 'Ochtend' },
  { id: 'snack1', label: 'Fruit Moment' },
  { id: 'middag', label: 'Middag' },
  { id: 'snack2', label: 'Snack' },
  { id: 'avond', label: 'Avond' },
];

export const WEEKDAYS = [
  'maandag', 'dinsdag', 'woensdag', 'donderdag',
  'vrijdag', 'zaterdag', 'zondag',
] as const;

export type Weekday = typeof WEEKDAYS[number];

export function slotToMealMoment(slotId: ScheduleSlotId): MealMomentId {
  const map: Record<ScheduleSlotId, MealMomentId> = {
    ochtend: 'ochtend',
    snack1: 'fruit moment',
    middag: 'middag',
    snack2: 'snack',
    avond: 'avond',
  };
  return map[slotId];
}

export function getSlotLabel(id: string): string {
  return SCHEDULE_SLOTS.find(s => s.id === id)?.label ?? id;
}

export function getMealMomentLabel(id: string): string {
  return MEAL_MOMENTS.find(m => m.id === id)?.label ?? id;
}
