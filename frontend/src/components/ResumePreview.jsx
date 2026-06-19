const sectionLabels = {
  professional_summary: "Professional Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  achievements: "Achievements",
};

function DateRange({ start, end }) {
  if (!start && !end) return null;
  return <span>{[start, end].filter(Boolean).join(" - ")}</span>;
}

function normalizeWebUrl(value) {
  const cleaned = String(value || "").replace(/\s+/g, "").trim();
  if (!cleaned) return "";

  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(cleaned) ? cleaned : `https://${cleaned}`;
    const parsed = new URL(withScheme);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function ContactLink({ label, href }) {
  if (!label) return null;

  if (!href) {
    return <span>{label}</span>;
  }

  return (
    <a className="text-sky-700 underline-offset-2 hover:underline" href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

export default function ResumePreview({ resume }) {
  const sectionOrder = Array.isArray(resume.section_order) && resume.section_order.length
    ? resume.section_order
    : Object.keys(sectionLabels);
  const contactItems = [
    resume.header.email
      ? { label: resume.header.email, href: `mailto:${resume.header.email}` }
      : null,
    resume.header.phone ? { label: resume.header.phone } : null,
    resume.header.location ? { label: resume.header.location } : null,
    resume.header.linkedin
      ? { label: resume.header.linkedin, href: normalizeWebUrl(resume.header.linkedin) }
      : null,
    resume.header.github ? { label: resume.header.github, href: normalizeWebUrl(resume.header.github) } : null,
    resume.header.portfolio
      ? { label: resume.header.portfolio, href: normalizeWebUrl(resume.header.portfolio) }
      : null,
  ].filter(Boolean);

  return (
    <section className="section-panel">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950">Live Structured Preview</h2>
          <p className="text-sm text-slate-500">This mirrors the data sent to FastAPI.</p>
        </div>
      </div>

      <article className="rounded-md border border-slate-300 bg-white p-5 text-sm text-slate-900">
        <header className="border-b border-slate-300 pb-3 text-center">
          <h3 className="text-2xl font-bold text-slate-950">{resume.header.full_name || "Full Name"}</h3>
          <div className="mt-1 flex flex-wrap justify-center gap-x-1 text-xs text-slate-600">
            {contactItems.map((item, index) => (
              <span key={`${item.label}-${index}`} className="inline-flex gap-x-1">
                {index ? <span>|</span> : null}
                <ContactLink label={item.label} href={item.href} />
              </span>
            ))}
          </div>
        </header>

        <div className="mt-4 space-y-4">
          {sectionOrder.map((section) => {
            if (section === "professional_summary" && resume.professional_summary) {
              return (
                <PreviewSection key={section} title={sectionLabels[section]}>
                  <p className="leading-6">{resume.professional_summary}</p>
                </PreviewSection>
              );
            }

            if (section === "skills" && resume.skills?.length) {
              return (
                <PreviewSection key={section} title={sectionLabels[section]}>
                  <div className="space-y-1">
                    {resume.skills.map((skill, index) => (
                      <p key={`${skill.category}-${index}`}>
                        <span className="font-semibold">{skill.category}:</span> {skill.items.join(", ")}
                      </p>
                    ))}
                  </div>
                </PreviewSection>
              );
            }

            if (section === "experience" && resume.experience?.length) {
              return (
                <PreviewSection key={section} title={sectionLabels[section]}>
                  <div className="space-y-3">
                    {resume.experience.map((item, index) => (
                      <div key={`${item.company}-${index}`}>
                        <div className="flex flex-wrap justify-between gap-2">
                          <p className="font-semibold">
                            {item.title}
                            {item.company ? ` - ${item.company}` : ""}
                          </p>
                          <p className="text-xs text-slate-500">
                            <DateRange start={item.start_date} end={item.end_date} />
                          </p>
                        </div>
                        {item.location ? <p className="text-xs text-slate-600">{item.location}</p> : null}
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {item.bullets.filter(Boolean).map((bullet, bulletIndex) => (
                            <li key={`${index}-${bulletIndex}`}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </PreviewSection>
              );
            }

            if (section === "projects" && resume.projects?.length) {
              return (
                <PreviewSection key={section} title={sectionLabels[section]}>
                  <div className="space-y-3">
                    {resume.projects.map((project, index) => (
                      <div key={`${project.name}-${index}`}>
                        <div className="flex flex-wrap justify-between gap-2">
                          <p className="font-semibold">
                            {project.name}
                            {project.role ? ` - ${project.role}` : ""}
                          </p>
                          <p className="text-xs text-slate-500">
                            <DateRange start={project.start_date} end={project.end_date} />
                          </p>
                        </div>
                        {Array.isArray(project.technologies) && project.technologies.length ? (
                          <p className="text-xs italic text-slate-600">{project.technologies.join(", ")}</p>
                        ) : null}
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {project.bullets.filter(Boolean).map((bullet, bulletIndex) => (
                            <li key={`${index}-${bulletIndex}`}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </PreviewSection>
              );
            }

            if (section === "education" && resume.education?.length) {
              return (
                <PreviewSection key={section} title={sectionLabels[section]}>
                  <div className="space-y-2">
                    {resume.education.map((item, index) => (
                      <div key={`${item.institution}-${index}`}>
                        <div className="flex flex-wrap justify-between gap-2">
                          <p className="font-semibold">{item.institution}</p>
                          <p className="text-xs text-slate-500">{item.location}</p>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2 text-slate-700">
                          <p>
                            {item.degree}
                            {item.score ? ` | ${item.score}` : ""}
                          </p>
                          <p className="text-xs text-slate-500">
                            <DateRange start={item.start_date} end={item.end_date} />
                          </p>
                        </div>
                        {Array.isArray(item.coursework) && item.coursework.length ? (
                          <p className="text-xs text-slate-600">
                            <span className="font-semibold">Relevant Coursework:</span>{" "}
                            {item.coursework.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </PreviewSection>
              );
            }

            if (section === "certifications" && resume.certifications?.length) {
              return (
                <PreviewSection key={section} title={sectionLabels[section]}>
                  <ul className="list-disc space-y-1 pl-5">
                    {resume.certifications.map((certification, index) => (
                      <li key={`${certification.title}-${index}`}>
                        <span className="font-semibold">{certification.title}</span>
                        {certification.issuer ? ` - ${certification.issuer}` : ""}
                        {certification.date ? ` (${certification.date})` : ""}
                      </li>
                    ))}
                  </ul>
                </PreviewSection>
              );
            }

            if (section === "achievements" && resume.achievements?.length) {
              return (
                <PreviewSection key={section} title={sectionLabels[section]}>
                  <ul className="list-disc space-y-1 pl-5">
                    {resume.achievements.map((achievement, index) => (
                      <li key={`${achievement.title}-${index}`}>
                        <span className="font-semibold">{achievement.title}</span>
                        {achievement.date ? ` (${achievement.date})` : ""}
                        {achievement.description ? ` - ${achievement.description}` : ""}
                      </li>
                    ))}
                  </ul>
                </PreviewSection>
              );
            }

            return null;
          })}
        </div>
      </article>
    </section>
  );
}

function PreviewSection({ title, children }) {
  return (
    <section>
      <h4 className="border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-950">
        {title}
      </h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}
