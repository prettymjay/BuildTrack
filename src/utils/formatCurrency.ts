export function formatPesoValue(v: number) {
  if (!isFinite(v)) return '₱0.00';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    return `₱${(v / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '₱' + v.toFixed(2);
}

export function formatPesoCents(cents: number) {
  return formatPesoValue((cents || 0) / 100);
}

export default formatPesoValue;
