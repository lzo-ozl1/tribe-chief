export function assertCount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(label + " must be a non-negative safe integer");
  }
}

export function sumCounts(...values: number[]): number {
  let total = 0;
  for (const value of values) {
    assertCount(value, "Count");
    total += value;
    assertCount(total, "Total");
  }
  return total;
}
