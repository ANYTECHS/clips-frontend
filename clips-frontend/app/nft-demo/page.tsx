"use client";

import NFTCard from "@/components/vault/NFTCard";

export default function NFTDemoPage() {
  const demoNFTs = [
    {
      id: "1",
      title: "Epic Gaming Moment - Triple Kill",
      thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=400&fit=crop",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      duration: "0:45",
      aiScore: 95,
      status: "ready_to_mint" as const,
      rarity: "epic" as const,
    },
    {
      id: "2",
      title: "Funny Cat Compilation",
      thumbnail: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop",
      duration: "1:30",
      aiScore: 88,
      status: "queue" as const,
      rarity: "rare" as const,
      queuePosition: 5,
    },
    {
      id: "3",
      title: "Tutorial: How to Code",
      thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=400&fit=crop",
      duration: "2:15",
      aiScore: 92,
      status: "minted" as const,
      rarity: "legendary" as const,
      floorPrice: 0.5,
      currentValue: 0.75,
      mintedDate: "2024-01-15",
    },
    {
      id: "4",
      title: "Travel Vlog - Tokyo",
      thumbnail: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=400&fit=crop",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      duration: "3:00",
      aiScore: 85,
      status: "ready_to_mint" as const,
      rarity: "uncommon" as const,
    },
    {
      id: "5",
      title: "Music Cover - Acoustic",
      thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop",
      duration: "0:30",
      aiScore: 90,
      status: "queue" as const,
      rarity: "common" as const,
      queuePosition: 12,
    },
    {
      id: "6",
      title: "Sports Highlight - Amazing Goal",
      thumbnail: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&h=400&fit=crop",
      duration: "0:15",
      aiScore: 98,
      status: "minted" as const,
      rarity: "epic" as const,
      floorPrice: 0.3,
      currentValue: 0.28,
      mintedDate: "2024-02-20",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">NFT Card Component Demo</h1>
        <p className="text-muted mb-8">Showcasing all mint states: Ready to Mint, Queue, and Minted</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {demoNFTs.map((nft) => (
            <NFTCard key={nft.id} {...nft} />
          ))}
        </div>

        <div className="mt-12 p-6 bg-surface border border-border rounded-xl">
          <h2 className="text-2xl font-bold text-white mb-4">Component Features</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>✅ AI score badge with sparkles icon</li>
            <li>✅ Video/image preview with hover play</li>
            <li>✅ Duration display with clock icon</li>
            <li>✅ Three mint states: Ready to Mint, Queue, Minted</li>
            <li>✅ Conditional rendering based on status</li>
            <li>✅ Smooth hover interactions and animations</li>
            <li>✅ Rarity badges with gradient styles</li>
            <li>✅ Price information for minted NFTs</li>
            <li>✅ Queue position display for queued items</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
