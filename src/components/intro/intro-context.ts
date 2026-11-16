import { createContext, useContext } from 'react'

/**
 * Opens the product introduction. The introduction is mounted by
 * ProductIntroProvider in App.tsx, outside the hash router, so its live
 * preview can run its own router. This module carries no styles, so importing
 * it from the guide does not change the order of the CSS bundle.
 */
export interface ProductIntroControls {
  open: () => void
}
export const ProductIntroContext = createContext<ProductIntroControls | null>(
  null,
)
export const useProductIntro = () => useContext(ProductIntroContext)
