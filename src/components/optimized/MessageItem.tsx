/**
 * Optimized Message Item Component
 * Uses React.memo to prevent unnecessary re-renders
 */

import React, { memo } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface MessageItemProps {
  id: string;
  content: string;
  senderName: string;
  senderAvatar?: string;
  createdAt: string;
  isOwn: boolean;
  isOptimistic?: boolean;
}

export const MessageItem = memo(function MessageItem({
  id,
  content,
  senderName,
  senderAvatar,
  createdAt,
  isOwn,
  isOptimistic = false,
}: MessageItemProps) {
  return (
    <div
      className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${isOptimistic ? 'opacity-50' : ''}`}
      data-message-id={id}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {senderAvatar ? (
          <img
            src={senderAvatar}
            alt={senderName}
            className="w-8 h-8 rounded-full"
            loading="lazy"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            {senderName[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Message content */}
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
        <div className={`px-4 py-2 rounded-lg ${isOwn ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        </div>
        <span className="text-xs text-gray-500 mt-1">
          {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these props change
  return (
    prevProps.id === nextProps.id &&
    prevProps.content === nextProps.content &&
    prevProps.isOptimistic === nextProps.isOptimistic
  );
});
