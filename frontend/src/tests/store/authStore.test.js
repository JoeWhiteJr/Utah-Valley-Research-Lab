import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../services/api'

// Mock the API module
vi.mock('../../services/api', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn()
  }
}))

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      token: null,
      isLoading: true,
      error: null
    })
    vi.clearAllMocks()
    localStorage.getItem.mockReturnValue(null)
  })

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isLoading).toBe(true)
      expect(state.error).toBeNull()
    })
  })

  describe('initialize', () => {
    it('sets isLoading to false when no token', async () => {
      localStorage.getItem.mockReturnValue(null)

      await useAuthStore.getState().initialize()

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.user).toBeNull()
    })

    it('fetches user data when token exists', async () => {
      localStorage.getItem.mockReturnValue('valid-token')
      authApi.me.mockResolvedValue({ data: { user: { id: '1', name: 'Test User' } } })

      await useAuthStore.getState().initialize()

      const state = useAuthStore.getState()
      expect(state.user).toEqual({ id: '1', name: 'Test User' })
      expect(state.isLoading).toBe(false)
    })

    it('clears token when API call fails', async () => {
      localStorage.getItem.mockReturnValue('invalid-token')
      authApi.me.mockRejectedValue(new Error('Unauthorized'))

      await useAuthStore.getState().initialize()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isLoading).toBe(false)
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    })
  })

  describe('login', () => {
    it('sets user and token on successful login', async () => {
      authApi.login.mockResolvedValue({
        data: {
          user: { id: '1', name: 'Test User', email: 'test@example.com' },
          token: 'new-token'
        }
      })

      const result = await useAuthStore.getState().login('test@example.com', 'password')

      expect(result).toBe(true)
      const state = useAuthStore.getState()
      expect(state.user).toEqual({ id: '1', name: 'Test User', email: 'test@example.com', is_super_admin: false })
      expect(state.token).toBe('new-token')
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'new-token')
    })

    it('sets error on failed login', async () => {
      authApi.login.mockRejectedValue({
        response: { data: { error: { message: 'Invalid credentials' } } }
      })

      const result = await useAuthStore.getState().login('test@example.com', 'wrongpassword')

      expect(result).toBe(false)
      const state = useAuthStore.getState()
      expect(state.error).toBe('Invalid credentials')
      expect(state.user).toBeNull()
    })

    it('sets default error message when response lacks detail', async () => {
      authApi.login.mockRejectedValue(new Error('Network error'))

      const result = await useAuthStore.getState().login('test@example.com', 'password')

      expect(result).toBe(false)
      const state = useAuthStore.getState()
      expect(state.error).toBe('Login failed')
    })

    it('clears previous error before login attempt', async () => {
      useAuthStore.setState({ error: 'Previous error' })
      authApi.login.mockResolvedValue({
        data: { user: { id: '1' }, token: 'token' }
      })

      await useAuthStore.getState().login('test@example.com', 'password')

      const state = useAuthStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('register', () => {
    it('sets user and token on successful registration', async () => {
      authApi.register.mockResolvedValue({
        data: {
          user: { id: '1', name: 'New User', email: 'new@example.com' },
          token: 'new-token'
        }
      })

      const result = await useAuthStore.getState().register('New User', 'new@example.com', 'password')

      expect(result).toEqual({ success: true, requiresApproval: false })
      const state = useAuthStore.getState()
      expect(state.user).toEqual({ id: '1', name: 'New User', email: 'new@example.com', is_super_admin: false })
      expect(state.token).toBe('new-token')
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'new-token')
    })

    it('sets error on failed registration', async () => {
      authApi.register.mockRejectedValue({
        response: { data: { error: { message: 'Email already exists' } } }
      })

      const result = await useAuthStore.getState().register('User', 'existing@example.com', 'password')

      expect(result).toEqual({ success: false })
      const state = useAuthStore.getState()
      expect(state.error).toBe('Email already exists')
    })

    it('sets default error message when response lacks detail', async () => {
      authApi.register.mockRejectedValue(new Error('Network error'))

      const result = await useAuthStore.getState().register('User', 'test@example.com', 'password')

      expect(result).toEqual({ success: false })
      const state = useAuthStore.getState()
      expect(state.error).toBe('Registration failed')
    })
  })

  describe('logout', () => {
    it('clears user and token', async () => {
      useAuthStore.setState({
        user: { id: '1', name: 'Test' },
        token: 'some-token'
      })

      await useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    })

    it('calls logout API', async () => {
      await useAuthStore.getState().logout()
      expect(authApi.logout).toHaveBeenCalled()
    })

    it('still clears state even if API call fails', async () => {
      authApi.logout.mockRejectedValue(new Error('Network error'))
      useAuthStore.setState({
        user: { id: '1' },
        token: 'token'
      })

      await useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
    })
  })

  describe('updateUser', () => {
    it('updates user in state', () => {
      const newUser = { id: '1', name: 'Updated Name', email: 'test@example.com' }

      useAuthStore.getState().updateUser(newUser)

      const state = useAuthStore.getState()
      expect(state.user).toEqual(newUser)
    })
  })

  describe('clearError', () => {
    it('clears error state', () => {
      useAuthStore.setState({ error: 'Some error' })

      useAuthStore.getState().clearError()

      const state = useAuthStore.getState()
      expect(state.error).toBeNull()
    })
  })
})
