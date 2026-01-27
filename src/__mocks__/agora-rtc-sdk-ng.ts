/**
 * Mock for Agora RTC SDK
 * Used in Jest tests to avoid importing the actual SDK
 */

export const createClient = jest.fn(() => ({
  join: jest.fn().mockResolvedValue(undefined),
  leave: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockResolvedValue(undefined),
  unpublish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  setClientRole: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
  renewToken: jest.fn().mockResolvedValue(undefined),
  getLocalAudioStats: jest.fn().mockReturnValue({}),
  getRemoteAudioStats: jest.fn().mockReturnValue({}),
  getLocalVideoStats: jest.fn().mockReturnValue({}),
  getRemoteVideoStats: jest.fn().mockReturnValue({}),
}))

export const createMicrophoneAudioTrack = jest.fn().mockResolvedValue({
  play: jest.fn(),
  stop: jest.fn(),
  close: jest.fn(),
  setEnabled: jest.fn(),
  setVolume: jest.fn(),
  getVolumeLevel: jest.fn().mockReturnValue(0),
})

export const createCameraVideoTrack = jest.fn().mockResolvedValue({
  play: jest.fn(),
  stop: jest.fn(),
  close: jest.fn(),
  setEnabled: jest.fn(),
})

export const createScreenVideoTrack = jest.fn().mockResolvedValue({
  play: jest.fn(),
  stop: jest.fn(),
  close: jest.fn(),
})

export const AgoraRTCError = class AgoraRTCError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'AgoraRTCError'
  }
}

export default {
  createClient,
  createMicrophoneAudioTrack,
  createCameraVideoTrack,
  createScreenVideoTrack,
  AgoraRTCError,
}
