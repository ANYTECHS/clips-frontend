import React from 'react';
import { Icon } from '../Icon';
import { Button } from './Button';

export type SocialPlatform = 'tiktok' | 'instagram' | 'youtube' | 'x';

export interface SocialPlatformCardProps {
  platform: SocialPlatform;
  isConnected?: boolean;
  username?: string;
  onConnect?: () => void;
  onManage?: () => void;
  className?: string;
}

const platformConfig = {
  tiktok: {
    name: 'TikTok',
    color: '#FE2C55',
    bgColor: 'rgba(254, 44, 85, 0.1)',
  },
  instagram: {
    name: 'Instagram',
    color: '#E4405F',
    bgColor: 'rgba(228, 64, 95, 0.1)',
  },
  youtube: {
    name: 'YouTube',
    color: '#FF0000',
    bgColor: 'rgba(255, 0, 0, 0.1)',
  },
  x: {
    name: 'X',
    color: '#000000',
    bgColor: 'rgba(0, 0, 0, 0.1)',
  },
};

export function SocialPlatformCard({
  platform,
  isConnected = false,
  username,
  onConnect,
  onManage,
  className = '',
}: SocialPlatformCardProps) {
  const config = platformConfig[platform];
  
  return (
    <div
      className={`
        relative bg-[#121212] border border-[#2A2A2A] rounded-2xl p-6
        transition-all duration-300 hover:border-[#17f9bf] hover:shadow-[0_0_20px_rgba(23,249,191,0.1)]
        ${className}
      `}
    >
      {/* Header with platform icon and status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: config.bgColor }}
          >
            <Icon
              name={platform}
              className="w-5 h-5"
              style={{ color: config.color }}
            />
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">{config.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {isConnected ? (
                <>
                  <div className="w-2 h-2 bg-[#17f9bf] rounded-full"></div>
                  <span className="text-[#17f9bf] text-sm font-medium">Active</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                  <span className="text-gray-500 text-sm">Not Linked</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic subtext */}
      <div className="mb-6">
        {isConnected && username ? (
          <p className="text-gray-300">
            Connected as <span className="text-white font-medium">@{username}</span>
          </p>
        ) : (
          <p className="text-gray-400">Connect to sync your content and analytics</p>
        )}
      </div>

      {/* Action button */}
      <div className="flex justify-end">
        {isConnected ? (
          <Button
            variant="outline"
            onClick={onManage}
            className="border-gray-700 text-white hover:border-[#17f9bf] hover:text-[#17f9bf]"
          >
            Manage
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={onConnect}
            className="bg-[#17f9bf] text-black hover:bg-[#88ffd9]"
          >
            Connect Account
          </Button>
        )}
      </div>
    </div>
  );
}
