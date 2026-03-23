import Sidebar from "../components/navigation/Sidebar";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Sidebar />
      <main className="min-h-screen pl-64" />
    </div>
  );
}
