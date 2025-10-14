// Authentication Types
export interface SignUpData {
  email: string
  password: string
  name: string
}

export interface SignInData {
  email: string
  password: string
}

export interface AuthResponse {
  success: boolean
  message?: string
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
  error?: string
}