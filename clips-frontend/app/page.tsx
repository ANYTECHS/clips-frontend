
import ProgressCard from "@/components/ProgressCard";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-[80%] mx-auto">
        <ProgressCard
          percentage={87}
          estimatedTimeRemaining="1 minute 15 seconds"
        />
      </main>

import Sidebar from "../components/navigation/Sidebar";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Sidebar />
      <main className="min-h-screen pl-64" />

    </div>
  );
}
