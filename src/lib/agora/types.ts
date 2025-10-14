// Agora RTC Types and Interfaces

import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalVideoTrack,
  ILocalAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
  NetworkQuality,
  UID,
} from 'agora-rtc-sdk-ng'

export interface AgoraConfig {
  appId: string
  channel: string
  token: string
  uid: UID
}

export interface RemoteUser {
  uid: UID
  hasAudio: boolean
  hasVideo: boolean
  hasScreenShare: boolean
  videoTrack?: IRemoteVideoTrack
  audioTrack?: IRemoteAudioTrack
  screenTrack?: IRemoteVideoTrack
}

export interface LocalTracks {
  videoTrack: ILocalVideoTrack | null
  audioTrack: ILocalAudioTrack | null
  screenTrack: ILocalVideoTrack | null
}

export interface VideoCallState {
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null
  localAudioEnabled: boolean
  localVideoEnabled: boolean
  isScreenSharing: boolean
  remoteUsers: Map<UID, RemoteUser>
  networkQuality: NetworkQuality | null
  screenShareUserId: UID | null
}

export interface UseVideoCallReturn extends VideoCallState {
  // Actions
  joinCall: () => Promise<void>
  leaveCall: () => Promise<void>
  toggleAudio: () => Promise<void>
  toggleVideo: () => Promise<void>
  startScreenShare: () => Promise<void>
  stopScreenShare: () => Promise<void>
  setVolume: (uid: UID, volume: number) => void

  // Client reference
  client: IAgoraRTCClient | null
  localTracks: LocalTracks
}

export type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalVideoTrack,
  ILocalAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
  NetworkQuality,
  UID,
}
