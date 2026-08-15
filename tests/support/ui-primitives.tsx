import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode
  size?: 'sm'
  variant?: 'outline'
}

export function Button({ size: _size, variant: _variant, ...props }: ButtonProps): ReactNode {
  return <button {...props} />
}
