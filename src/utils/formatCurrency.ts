export function formatPesoValue(v: number) {
  if (!isFinite(v)) return '₱0.00';

  return `₱${v.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPesoCents(cents: number) {
  return formatPesoValue((cents || 0) / 100);
}

export default formatPesoValue;
