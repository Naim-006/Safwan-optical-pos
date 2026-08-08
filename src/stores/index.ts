import { create } from 'zustand'

type CartItem = Record<string, any> & { cartQuantity: number }

interface PosStore {
  cart: CartItem[]
  discount: number
  addToCart: (product: Record<string, any>, quantity?: number) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  setDiscount: (discount: number) => void
  clearCart: () => void
  getCartTotal: () => number
  getItemCount: () => number
}

export const usePosStore = create<PosStore>((set, get) => ({
  cart: [],
  discount: 0,

  addToCart: (product, quantity = 1) => {
    set((state) => {
      const existing = state.cart.find((item) => item.id === product.id)
      if (existing) {
        return {
          cart: state.cart.map((item) =>
            item.id === product.id
              ? { ...item, cartQuantity: item.cartQuantity + quantity }
              : item
          ),
        }
      }
      return { cart: [...state.cart, { ...product, cartQuantity: quantity }] }
    })
  },

  removeFromCart: (productId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.id !== productId),
    }))
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId)
      return
    }
    set((state) => ({
      cart: state.cart.map((item) =>
        item.id === productId ? { ...item, cartQuantity: quantity } : item
      ),
    }))
  },

  setDiscount: (discount) => set({ discount }),

  clearCart: () => set({ cart: [], discount: 0 }),

  getCartTotal: () => {
    const { cart, discount } = get()
    const subtotal = cart.reduce(
      (sum, item) => sum + item.price * item.cartQuantity,
      0
    )
    return subtotal - discount
  },

  getItemCount: () => {
    return get().cart.reduce((sum, item) => sum + item.cartQuantity, 0)
  },
}))

interface SearchStore {
  recentScans: string[]
  addScan: (barcode: string) => void
  clearScans: () => void
}

export const useSearchStore = create<SearchStore>((set) => ({
  recentScans: [],
  addScan: (barcode) => {
    set((state) => ({
      recentScans: [barcode, ...state.recentScans.filter((s) => s !== barcode)].slice(0, 10),
    }))
  },
  clearScans: () => set({ recentScans: [] }),
}))

interface UiStore {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  language: 'en' | 'ar'
  setLanguage: (lang: 'en' | 'ar') => void
}

export const useUiStore = create<UiStore>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  language: 'en',
  setLanguage: (lang) => set({ language: lang }),
}))
