// Body zones used to categorise photos. The id is what gets stored in DB —
// keep it stable. The label is what we show to humans.

export type BodyZone = {
  id: string
  label: string
  side: 'front' | 'back'
}

export const BODY_ZONES: BodyZone[] = [
  // Front
  { id: 'face',         label: 'Visage',           side: 'front' },
  { id: 'neck',         label: 'Cou',              side: 'front' },
  { id: 'chest',        label: 'Torse',            side: 'front' },
  { id: 'abdomen',      label: 'Ventre',           side: 'front' },
  { id: 'arm-left',     label: 'Bras gauche',      side: 'front' },
  { id: 'arm-right',    label: 'Bras droit',       side: 'front' },
  { id: 'hand-left',    label: 'Main gauche',      side: 'front' },
  { id: 'hand-right',   label: 'Main droite',      side: 'front' },
  { id: 'thigh-left',   label: 'Cuisse gauche',    side: 'front' },
  { id: 'thigh-right',  label: 'Cuisse droite',    side: 'front' },
  { id: 'shin-left',    label: 'Tibia gauche',     side: 'front' },
  { id: 'shin-right',   label: 'Tibia droit',      side: 'front' },
  // Back
  { id: 'scalp',        label: 'Crâne / cuir chevelu', side: 'back' },
  { id: 'back-upper',   label: 'Haut du dos',      side: 'back' },
  { id: 'back-lower',   label: 'Bas du dos',       side: 'back' },
  { id: 'glutes',       label: 'Fessiers',         side: 'back' },
  { id: 'calf-left',    label: 'Mollet gauche',    side: 'back' },
  { id: 'calf-right',   label: 'Mollet droit',     side: 'back' },
  // Generic
  { id: 'other',        label: 'Autre',            side: 'front' },
]

export const BODY_ZONES_BY_ID = Object.fromEntries(BODY_ZONES.map(z => [z.id, z]))

export function zoneLabel(id: string): string {
  return BODY_ZONES_BY_ID[id]?.label ?? id
}
