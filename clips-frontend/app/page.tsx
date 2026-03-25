import Sidebar from "../components/navigation/Sidebar";
import AiInsightCard from "./components/AiInsightCard";
import MetricsCards from "./MetricsCards";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex">
      {/* Sidebar on the left */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 pl-64 flex flex-col items-center justify-center p-8 gap-12">
        
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Dashboard Overview
          </h1>
          <p className="text-zinc-400 max-w-md mx-auto">
            View your latest video performance and AI-generated insights here.
          </p>
        </div>

        {/* Your AI Insight Card! */}
        <div className="w-full flex justify-center">
          <AiInsightCard />
        </div>

        {/* Other metrics below */}
        <div className="w-full max-w-5xl">
          <MetricsCards />
        </div>

      </main>
    </div>
  );
}
