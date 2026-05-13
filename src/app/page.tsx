import { PipelineExperience } from "@/components/pipeline-experience";

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1">
        <PipelineExperience />
      </main>
      <footer className="border-t border-[#334155] bg-[#0f172a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-xs text-[#94a3b8] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 font-mono">
          <span>
            Built by Augusto García ·{" "}
            <a
              href="https://github.com/augusto-devingcc"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#34d399]"
            >
              github.com/augusto-devingcc
            </a>
          </span>
          <span>Companion Python CLI in /cli</span>
        </div>
      </footer>
    </div>
  );
}
