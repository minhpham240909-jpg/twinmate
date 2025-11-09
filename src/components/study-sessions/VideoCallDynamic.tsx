'use client'

import dynamic from 'next/dynamic'
import React from 'react'

// Loading skeleton shown while Agora SDK loads
function VideoCallSkeleton() {
  return (
    <div className="flex items-center justify-center h-full w-full bg-gray-900">
      <div className="text-center">
        <div className="mb-4">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        </div>
        <p className="text-white text-lg font-medium">Connecting to video call...</p>
        <p className="text-gray-400 text-sm mt-2">Loading video SDK</p>
      </div>
    </div>
  )
}

// Dynamically import VideoCall component to defer Agora SDK loading
// This reduces the initial bundle size by ~300KB
const VideoCallDynamic = dynamic(
  () => import('./VideoCall'),
  {
    loading: () => <VideoCallSkeleton />,
    ssr: false, // Agora SDK is client-side only
  }
)

export default VideoCallDynamic
