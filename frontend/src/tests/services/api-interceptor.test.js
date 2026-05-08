import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture the interceptor handlers axios receives so we can invoke them
// directly. We are unit-testing the interceptor logic, not axios itself,
// so a real network round-trip would only obscure intent.
//
// `vi.hoisted` lets the mock factory (which vitest hoists above imports)
// reach these holders without tripping the temporal-dead-zone that bites
// any plain top-level `const`.
const { responseInterceptors, requestInterceptors } = vi.hoisted(() => ({
  responseInterceptors: { onFulfilled: null, onRejected: null },
  requestInterceptors: { onFulfilled: null, onRejected: null },
}))

vi.mock('axios', () => {
  const fakeInstance = {
    interceptors: {
      request: {
        use: (onFulfilled, onRejected) => {
          requestInterceptors.onFulfilled = onFulfilled
          requestInterceptors.onRejected = onRejected
        },
      },
      response: {
        use: (onFulfilled, onRejected) => {
          responseInterceptors.onFulfilled = onFulfilled
          responseInterceptors.onRejected = onRejected
        },
      },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }
  return {
    default: {
      create: vi.fn(() => fakeInstance),
      isCancel: vi.fn(() => false),
    },
  }
})

// Stub the toast store so we can assert on calls without rendering anything.
vi.mock('../../store/toastStore', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  useToastStore: { getState: vi.fn() },
}))

// Stub the auth store so the dynamic import inside the 401 branch resolves
// without dragging in real auth state.
vi.mock('../../store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({ logout: vi.fn() })),
  },
}))

// Importing the module registers the interceptors against our fake axios
// instance, populating `responseInterceptors`. `vi.mock` calls above are
// hoisted by vitest, so the module sees the mocked axios + stores.
import '../../services/api'
import { toast } from '../../store/toastStore'

describe('api response interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Make sure the original location can't actually navigate during tests.
    delete window.location
    window.location = { href: '' }
  })

  it('shows an error toast on 5xx responses', async () => {
    const error = {
      response: { status: 500, data: { error: { message: 'Boom' } } },
      config: { url: '/projects/1/pin' },
    }

    await expect(responseInterceptors.onRejected(error)).rejects.toBe(error)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('Boom')
  })

  it('falls back to a generic message when 5xx body has no message', async () => {
    const error = {
      response: { status: 503, data: {} },
      config: { url: '/projects' },
    }

    await expect(responseInterceptors.onRejected(error)).rejects.toBe(error)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error.mock.calls[0][0]).toMatch(/something went wrong/i)
  })

  it('shows a network-flavored toast when there is no response (offline / timeout)', async () => {
    const error = {
      message: 'Network Error',
      config: { url: '/projects' },
    }

    await expect(responseInterceptors.onRejected(error)).rejects.toBe(error)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error.mock.calls[0][0]).toMatch(/network/i)
  })

  it('does not toast on a successful response', () => {
    const response = { status: 200, data: { ok: true } }
    expect(responseInterceptors.onFulfilled(response)).toBe(response)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('preserves 401 redirect behavior and does not toast', async () => {
    const error = {
      response: { status: 401 },
      config: { url: '/projects' },
    }

    await expect(responseInterceptors.onRejected(error)).rejects.toBe(error)
    // 401 is handled by the existing auth flow, not by a generic toast.
    expect(toast.error).not.toHaveBeenCalled()
    expect(localStorage.removeItem).toHaveBeenCalledWith('token')
  })

  it('does not toast on 401 from /auth/login (caller renders inline error)', async () => {
    const error = {
      response: { status: 401 },
      config: { url: '/auth/login' },
    }

    await expect(responseInterceptors.onRejected(error)).rejects.toBe(error)
    expect(toast.error).not.toHaveBeenCalled()
    expect(localStorage.removeItem).not.toHaveBeenCalled()
  })

  it('does not toast on plain 4xx responses (callers handle these)', async () => {
    for (const status of [400, 403, 404, 422]) {
      const error = {
        response: { status, data: { error: { message: 'nope' } } },
        config: { url: '/projects/1' },
      }
      // 403 ACCOUNT_DELETED is its own branch; plain 403 falls through silently.
      await expect(responseInterceptors.onRejected(error)).rejects.toBe(error)
    }
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('respects _silent: true on 5xx', async () => {
    const error = {
      response: { status: 500, data: { error: { message: 'shh' } } },
      config: { url: '/projects/1', _silent: true },
    }

    await expect(responseInterceptors.onRejected(error)).rejects.toBe(error)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('respects _silent: true on network errors', async () => {
    const error = {
      message: 'Network Error',
      config: { url: '/projects', _silent: true },
    }

    await expect(responseInterceptors.onRejected(error)).rejects.toBe(error)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('does not toast for cancelled requests (ERR_CANCELED)', async () => {
    const error = {
      message: 'canceled',
      code: 'ERR_CANCELED',
      config: { url: '/projects' },
    }

    await expect(responseInterceptors.onRejected(error)).rejects.toBe(error)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('still rejects (caller try/catch keeps working)', async () => {
    const error = {
      response: { status: 500, data: {} },
      config: { url: '/projects' },
    }
    let caught = null
    try {
      await responseInterceptors.onRejected(error)
    } catch (e) {
      caught = e
    }
    expect(caught).toBe(error)
  })
})
