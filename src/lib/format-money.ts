/** Format exact integer cents, including values too large for lossless USD doubles. */
export function formatUSD(cents: number | bigint): string {
  const integer = BigInt(cents)
  const absolute = integer < 0n ? -integer : integer
  return `${integer < 0n ? '-' : ''}$${(absolute / 100n).toLocaleString('en-US')}.${(absolute % 100n).toString().padStart(2, '0')}`
}
