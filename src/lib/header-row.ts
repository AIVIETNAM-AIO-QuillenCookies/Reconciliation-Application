export const MAX_HEADER_ROW = 1_048_576
export type HeaderRowUpdate = number | ((previous: number) => number)
export type PreviewErrorKind = 'header-row' | 'file'

export function isValidHeaderRow(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_HEADER_ROW
}

export function validateHeaderRow(value: number): void {
  if (!isValidHeaderRow(value))
    throw new RangeError(
      `Choose a whole header row number between 1 and ${MAX_HEADER_ROW.toLocaleString('en-US')}.`,
    )
}

/** Structured across worker boundaries so a header problem can offer recovery. */
export class HeaderRowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HeaderRowError'
  }
}
