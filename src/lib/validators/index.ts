import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  category: z.string().optional(),
  barcode: z.string().min(1, 'Barcode is required'),
  price: z.number().min(0, 'Price must be positive'),
  quantity: z.number().int().min(0, 'Quantity must be positive'),
})

export const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  rightSphere: z.number().optional().nullable(),
  rightCylinder: z.number().optional().nullable(),
  rightAxis: z.number().optional().nullable(),
  rightAdd: z.number().optional().nullable(),
  leftSphere: z.number().optional().nullable(),
  leftCylinder: z.number().optional().nullable(),
  leftAxis: z.number().optional().nullable(),
  leftAdd: z.number().optional().nullable(),
  ipd: z.number().optional().nullable(),
  eyeType: z.string().optional(),
  lensType: z.string().optional(),
  notes: z.string().optional(),
})

export const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Price must be positive'),
  totalPrice: z.number(),
})

export const invoiceSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  customerId: z.string().optional().nullable(),
  eyeType: z.string().optional(),
  lensType: z.string().optional(),
  rightSphere: z.number().optional().nullable(),
  rightCylinder: z.number().optional().nullable(),
  rightAxis: z.number().optional().nullable(),
  rightAdd: z.number().optional().nullable(),
  leftSphere: z.number().optional().nullable(),
  leftCylinder: z.number().optional().nullable(),
  leftAxis: z.number().optional().nullable(),
  leftAdd: z.number().optional().nullable(),
  ipd: z.number().optional().nullable(),
  subtotal: z.number(),
  discount: z.number().min(0).default(0),
  totalAmount: z.number(),
  amountPaid: z.number().min(0).default(0),
  balanceDue: z.number().default(0),
  paymentStatus: z.enum(['paid', 'partial', 'unpaid']),
  paymentMethod: z.enum(['cash', 'card', 'transfer']).optional().nullable(),
  invoiceType: z.enum(['pos', 'optical', 'receipt']),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
})

export const settingsSchema = z.object({
  shopName: z.string().min(1, 'Shop name is required'),
  shopAddress: z.string().optional(),
  shopPhone: z.string().optional(),
  shopVat: z.string().optional(),
  shopWebsite: z.string().optional(),
  receiptHeader: z.string().optional(),
  receiptFooter: z.string().optional(),
  currency: z.string().default('SAR'),
  language: z.enum(['en', 'ar']).default('en'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ProductInput = z.infer<typeof productSchema>
export type CustomerInput = z.infer<typeof customerSchema>
export type InvoiceInput = z.infer<typeof invoiceSchema>
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>
export type SettingsInput = z.infer<typeof settingsSchema>
