export function inr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}
