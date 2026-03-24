import Image from "next/image";
import ApexImage from "@/app/assets/Container (1).svg";
import ReactImage from "@/app/assets/Container.svg";

export interface RecentProject {
  id: number;
  image: typeof ApexImage;
  title: string;
  clipsGenerated: number;
  status: "processing" | "completed";
  accent: string;
}

export const recentProjects: RecentProject[] = [
  {
    id: 1,
    image: ApexImage,
    title: "Apex Legends Clutch Breakdown and Post Match Analysis",
    clipsGenerated: 2,
    status: "processing" as const,
    accent:
      "radial-gradient(circle at 30% 25%, rgba(127, 221, 255, 0.55), transparent 32%), linear-gradient(145deg, #0b2230 0%, #112839 45%, #061218 100%)",
  },
  {
    id: 2,
    image: ReactImage,
    title: "React Native Tutorial",
    clipsGenerated: 12,
    status: "completed" as const,
    accent:
      "radial-gradient(circle at 50% 30%, rgba(170, 220, 206, 0.32), transparent 36%), linear-gradient(145deg, #536f66 0%, #62786f 48%, #241c19 100%)",
  },
];

export default function RecentProjects() {
  return (
    <main className="min-h-screen bg-[var(--page-background)] px-5 py-10 text-white sm:px-8 lg:px-12">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="md:text-[20px] font-black tracking-[-0.04em] text-[#F1F5F9] text-[18px]">
              Recent Projects
            </h1>
          </div>
          <a
            href="#"
            className="text-[14px] font-bold text-[#00FF9D] transition-all duration-200 hover:text-[var(--link-hover)] hover:underline hover:underline-offset-4"
          >
            View All
          </a>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {recentProjects.map((project) => (
            <article
              key={project.id}
              className="group flex min-h-[140px] items-center gap-4 rounded-2xl border border-white/6 bg-[var(--card-background)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div
                aria-hidden="true"
                className="relative h-24 w-24 shrink-0 rounded-xl border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                style={{ background: project.accent }}
              >
                <Image
                  src={project.image}
                  alt={project.title}
                  fill
                  className="object-cover rounded-xl"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold tracking-[-0.03em] text-white">
                    {project.title}
                  </h2>
                  <p className="mt-1 text-[12px] font-medium text-[var(--muted-text)]">
                    {project.clipsGenerated} clips generated
                  </p>
                </div>

                <span
                  className={`inline-flex w-fit items-center rounded-md px-3 py-1 text-xs font-extrabold tracking-[0.02em] ${
                    project.status === "processing"
                      ? "status-processing"
                      : "status-completed"
                  }`}
                >
                  {project.status === "processing" ? "PROCESSING" : "COMPLETED"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
