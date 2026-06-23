import Builder from "./pages/Builder.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-xl font-extrabold tracking-tight text-sky-700">
            Irenito Resu<span className="text-slate-900">Me</span>
          </span>
          <span className="text-xs text-slate-500">Build a professional resume in minutes</span>
        </div>
      </header>

      <Builder />
    </div>
  );
}
