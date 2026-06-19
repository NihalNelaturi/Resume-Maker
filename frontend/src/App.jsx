import Builder from "./pages/Builder.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="text-left">
            <span className="block text-base font-bold text-slate-950">Resume Command Center</span>
            <span className="block text-xs text-slate-500">Analyze, rewrite, and export tailored resumes</span>
          </div>
        </div>
      </header>

      <Builder />
    </div>
  );
}
