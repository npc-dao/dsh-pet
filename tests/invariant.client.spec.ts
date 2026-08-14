import { describe, expect, it, vi } from 'vitest'
import * as invariant from '../src/invariant.ts'

describe('dsh-pet invariant companion', () => {
  it('registers package ownership and returns the registration disposer', async () => {
    const dispose = vi.fn()
    const register = vi.fn().mockReturnValue(dispose)
    const ctx = { invariants: { register } } as never

    expect(invariant.name).toBe('dsh-pet-invariant')
    expect(invariant.inject).toEqual(['invariants'])
    const release = await invariant.apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-pet', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as () => void)() }).not.toThrow()
    release()
    expect(dispose).toHaveBeenCalledOnce()
  })
})
