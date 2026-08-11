/**
 * Pack sizes are always a structured { value, unit } pair chosen from this
 * fixed list — never free text — so "5kg", "5 Kg" and "5 kg" can't diverge
 * into three separate master products.
 */
export enum PackUnit {
  KG = 'kg',
  G = 'g',
  L = 'l',
  ML = 'ml',
  PIECE = 'piece',
  DOZEN = 'dozen',
  PACKET = 'packet',
  BAG = 'bag',
  BOX = 'box',
}

/**
 * Canonical measure every pack is reduced to, so equivalent packs compare
 * cleanly regardless of the unit they were entered in.
 */
export enum PackBaseUnit {
  G = 'g',
  ML = 'ml',
  COUNT = 'count',
}

const CONVERSIONS: Record<PackUnit, { baseUnit: PackBaseUnit; factor: number }> = {
  [PackUnit.KG]: { baseUnit: PackBaseUnit.G, factor: 1000 },
  [PackUnit.G]: { baseUnit: PackBaseUnit.G, factor: 1 },
  [PackUnit.L]: { baseUnit: PackBaseUnit.ML, factor: 1000 },
  [PackUnit.ML]: { baseUnit: PackBaseUnit.ML, factor: 1 },
  [PackUnit.PIECE]: { baseUnit: PackBaseUnit.COUNT, factor: 1 },
  [PackUnit.DOZEN]: { baseUnit: PackBaseUnit.COUNT, factor: 12 },
  // Container units have no fixed weight/volume — their real size varies by
  // product — so they're counted rather than measured.
  [PackUnit.PACKET]: { baseUnit: PackBaseUnit.COUNT, factor: 1 },
  [PackUnit.BAG]: { baseUnit: PackBaseUnit.COUNT, factor: 1 },
  [PackUnit.BOX]: { baseUnit: PackBaseUnit.COUNT, factor: 1 },
};

/**
 * Reduces a pack to its canonical base measure.
 *
 *   normalisePack(5, 'kg')     -> { baseValue: 5000, baseUnit: 'g' }
 *   normalisePack(1, 'dozen')  -> { baseValue: 12,   baseUnit: 'count' }
 *   normalisePack(12, 'piece') -> { baseValue: 12,   baseUnit: 'count' }
 *
 * Note the last two collapse to the same base — exactly what duplicate
 * detection needs.
 */
export function normalisePack(
  value: number,
  unit: PackUnit,
): { baseValue: number; baseUnit: PackBaseUnit } {
  const conversion = CONVERSIONS[unit];
  if (!conversion) {
    throw new Error(`Unsupported pack unit: ${unit}`);
  }
  return {
    baseValue: value * conversion.factor,
    baseUnit: conversion.baseUnit,
  };
}

/** Human-readable label, e.g. "5 kg" / "12 piece". */
export function formatPack(value: number, unit: PackUnit): string {
  // Drop a trailing ".00" so 5.00 renders as "5" but 1.50 stays "1.5".
  const trimmed = Number(value)
    .toFixed(2)
    .replace(/\.?0+$/, '');
  return `${trimmed} ${unit}`;
}
