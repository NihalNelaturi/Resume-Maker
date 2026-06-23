import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useState } from "react";

const sectionLabels = {
  professional_summary: "Professional Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  achievements: "Achievements",
};

export default function SectionOrderControl({ sectionOrder, onChange }) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  function handleDragStart(e, index) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  }

  function handleDrop(e, index) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const nextOrder = [...sectionOrder];
    const [moved] = nextOrder.splice(draggedIndex, 1);
    nextOrder.splice(index, 0, moved);

    onChange(nextOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  return (
    <section className="section-panel">
      <h2 className="text-base font-bold text-slate-950">Section order</h2>
      <p className="mt-1 text-sm text-slate-500">Header always stays first. Drag & drop sections to customize your layout.</p>

      <div className="mt-4 space-y-2">
        {sectionOrder.map((section, index) => {
          const isDragging = index === draggedIndex;
          const isDragOver = index === dragOverIndex;

          return (
            <div
              key={section}
              draggable="true"
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, index)}
              className={`flex items-center gap-3 rounded-md border px-3 py-2 bg-white transition-all duration-200 select-none ${
                isDragging
                  ? "border-sky-300 opacity-40 scale-98 shadow-inner"
                  : isDragOver
                    ? "border-sky-500 bg-sky-50/30 scale-102 shadow-md"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <div
                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 transition p-1"
                title="Drag to reorder"
              >
                <GripVertical size={16} />
              </div>
              <span className="text-sm font-semibold text-slate-800 flex-grow">{sectionLabels[section]}</span>
              
              <div className="flex gap-1">
                {index > 0 && (
                  <button
                    type="button"
                    title="Move up"
                    onClick={() => {
                      const nextOrder = [...sectionOrder];
                      const [moved] = nextOrder.splice(index, 1);
                      nextOrder.splice(index - 1, 0, moved);
                      onChange(nextOrder);
                    }}
                    className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                  >
                    <ArrowUp size={14} />
                  </button>
                )}
                {index < sectionOrder.length - 1 && (
                  <button
                    type="button"
                    title="Move down"
                    onClick={() => {
                      const nextOrder = [...sectionOrder];
                      const [moved] = nextOrder.splice(index, 1);
                      nextOrder.splice(index + 1, 0, moved);
                      onChange(nextOrder);
                    }}
                    className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                  >
                    <ArrowDown size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
