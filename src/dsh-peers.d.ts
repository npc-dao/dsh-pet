/** Development-only declarations for DSH services supplied by the Host runtime. */

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {}
  interface LocaleNamespaceMap {}
}

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ButtonHTMLAttributes, ReactNode } from 'react'

  interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children?: ReactNode
    size?: 'sm'
    variant?: 'outline'
  }

  export function Button(props: ButtonProps): ReactNode
}
