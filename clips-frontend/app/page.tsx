import CreatorBadge from "./components/CreatorsBadge";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#050505] px-4 py-20 text-white md:px-8">
      <section className="mx-auto max-w-5xl text-center">
        <h1 className="text-4xl font-bold md:text-6xl">Turn Long Videos Into Viral Clips</h1>
        <p className="mt-4 text-zinc-300">
          ClipCash helps creators generate, curate, and publish short clips in minutes.
        </p>

          {/* Onbaording proof section for issue #14 */}
         <CreatorBadge count="2,500+" label="creators joined this week." />
      </section>


     

    

      <section id="features" className="mx-auto mt-24 max-w-5xl">
        <h2 className="text-2xl font-semibold">Features</h2>
      </section>
      <section id="pricing" className="mx-auto mt-20 max-w-5xl">
        <h2 className="text-2xl font-semibold">Pricing</h2>
      </section>
      <section id="showcase" className="mx-auto mt-20 max-w-5xl">
        <h2 className="text-2xl font-semibold">Showcase</h2>
      </section>
      <section id="docs" className="mx-auto mt-20 max-w-5xl">
        <h2 className="text-2xl font-semibold">Docs</h2>
      </section>
    </div>
  );
}
