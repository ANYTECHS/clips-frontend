import React from 'react';
import { SocialPlatformCard } from '../components/ui/SocialPlatformCard';

export default function SocialPlatformDemo() {
  const handleConnect = (platform: string) => {
    console.log(`Connecting to ${platform}...`);
  };

  const handleManage = (platform: string) => {
    console.log(`Managing ${platform} account...`);
  };

  return (
    <div className="min-h-screen bg-[#050505] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Social Platform Integration</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Connected accounts */}
          <SocialPlatformCard
            platform="tiktok"
            isConnected={true}
            username="creator123"
            onManage={() => handleManage('TikTok')}
          />
          
          <SocialPlatformCard
            platform="instagram"
            isConnected={true}
            username="mybrand"
            onManage={() => handleManage('Instagram')}
          />
          
          {/* Not connected accounts */}
          <SocialPlatformCard
            platform="youtube"
            isConnected={false}
            onConnect={() => handleConnect('YouTube')}
          />
          
          <SocialPlatformCard
            platform="x"
            isConnected={false}
            onConnect={() => handleConnect('X')}
          />
        </div>
      </div>
    </div>
  );
}
