import { useState } from "react";
import {
  AdminShell,
  adminSlug,
  uniqueAdminSlug,
  type AdminPreview,
  type AdminProject,
} from "../src/settings-panel/admin";
import { IconPick } from "../src/settings-panel/kit-chrome";
import { PageBar } from "./page-bar";

const FONT = '"ABC Areal Variable", "ABC Areal", "Geist", ui-sans-serif, system-ui, sans-serif';
const CODE = "000000";

const SEED: AdminProject[] = [
  {
    id: "one",
    name: "Первый",
    year: "2024",
    length: "full",
    slug: "one",
    text: "Короткий текст проекта.",
    roles: [{ name: "Автор", labels: [] }],
    photos: [
      { id: "one-1", tone: "#8FA4B8", ratio: 4 / 5 },
      { id: "one-2", tone: "#C4A484", ratio: 3 / 2 },
    ],
    tone: "bg-white/35",
    published: true,
  },
  {
    id: "two",
    name: "Второй",
    year: "2025",
    length: "short",
    slug: "two",
    text: "Этот абзац на странице скрыт.",
    roles: [],
    photos: [{ id: "two-1", tone: "#7D8F72", ratio: 1 }],
    tone: "bg-white/25",
    published: true,
  },
  {
    id: "draft",
    name: "Черновик",
    year: "2026",
    length: "full",
    slug: "draft",
    text: "",
    roles: [],
    photos: [],
    status: "draft",
    tone: "bg-white/15",
    published: false,
  },
];

function clone(projects: readonly AdminProject[]) {
  return projects.map((project) => ({
    ...project,
    roles: project.roles.map((role) => ({ name: role.name, labels: [...role.labels] })),
    photos: project.photos.map((photo) => ({ ...photo })),
  }));
}

export function AdminPage() {
  const [theme, setTheme] = useState<"sun" | "moon">("sun");
  const [locale, setLocale] = useState<"ru" | "en">("ru");
  const [signedIn, setSignedIn] = useState(false);
  const [projects, setProjects] = useState<AdminProject[]>(() => clone(SEED));
  const [savedProjects, setSavedProjects] = useState<AdminProject[]>(() => clone(SEED));
  const [catalog, setCatalog] = useState(() => SEED.map((project) => project.id));
  const [savedCatalog, setSavedCatalog] = useState(() => SEED.map((project) => project.id));
  const [home, setHome] = useState(["one", "two"]);
  const [savedHome, setSavedHome] = useState(["one", "two"]);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminPreview>("draft");
  const [hidden, setHidden] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  const draft = projects.find((project) => project.id === editing) ?? null;
  const publishedCopy = savedProjects.find((project) => project.id === editing) ?? null;
  const held = editing ? hidden.includes(editing) || removed.includes(editing) : false;
  const onSite = preview === "site" && publishedCopy?.published && !held ? publishedCopy : null;
  const face = editing ? (preview === "site" ? onSite : draft) : null;
  const homeFaces = home.flatMap((id) => {
    if (hidden.includes(id) || removed.includes(id)) return [];
    const project = projects.find((item) => item.id === id);
    return project ? [project] : [];
  });

  function addProject() {
    const taken = projects.flatMap((project) => [project.id, project.slug]);
    const id = uniqueAdminSlug(adminSlug("Новый проект"), taken);
    const next: AdminProject = {
      id,
      name: "",
      year: String(new Date().getFullYear()),
      length: "full",
      slug: id,
      text: "",
      roles: [],
      photos: [],
      tone: "bg-white/20",
      published: false,
    };
    setProjects((current) => [...current, next]);
    setSavedProjects((current) => [...current, next]);
    setCatalog((current) => [...current, id]);
    setEditing(id);
    setPreview("draft");
  }

  function publishProject(next: AdminProject) {
    const stored = { ...next, published: true, status: undefined };
    setProjects((current) => current.map((project) => (project.id === next.id ? stored : project)));
    setSavedProjects((current) => current.map((project) => (project.id === next.id ? stored : project)));
  }

  return (
    <main data-new-ui="" className="relative min-h-dvh" style={{ background: "#ffffff", color: "#0b0b0b", fontFamily: FONT }}>
      <PageBar trailing={<IconPick value={theme} onChange={setTheme} options={[{ id: "sun", icon: "sun" }, { id: "moon", icon: "moon" }]} />} />
      <div className="flex min-h-dvh flex-col items-start gap-4 px-12 pt-28 pb-16">
        {face ? (
          <>
            <p className="text-[14px] leading-4 text-black/50">{preview === "site" ? "На сайте" : "Черновик"}</p>
            <h1 className="max-w-3xl text-[64px] leading-none">{face.name.trim() || "Новый проект"}</h1>
            <p className="text-[14px] leading-4 text-black/50">{face.year}</p>
            {face.length === "full" && face.text ? <p className="max-w-md text-[18px] leading-6">{face.text}</p> : null}
          </>
        ) : editing && preview === "site" ? (
          <p className="text-[18px] leading-6 text-black/50">{held ? "Проект скрыт" : "На сайте этого проекта ещё нет"}</p>
        ) : (
          <>
            <h1 className="text-[64px] leading-none">Сайт</h1>
            <p className="text-[18px] leading-6 text-black/50">{homeFaces.map((project) => project.name).join("  ·  ") || "Пусто"}</p>
            {signedIn ? null : <p className="text-[14px] leading-4 text-black/50">Код входа {CODE}</p>}
          </>
        )}
      </div>
      <AdminShell
        signedIn={signedIn}
        theme={theme === "moon" ? "dark" : "light"}
        locale={locale}
        projects={projects}
        savedProjects={savedProjects}
        catalog={catalog}
        home={home}
        savedCatalog={savedCatalog}
        savedHome={savedHome}
        editing={editing}
        preview={preview}
        hidden={hidden}
        removed={removed}
        onTheme={(next) => setTheme(next === "dark" ? "moon" : "sun")}
        onLocale={setLocale}
        onLeave={() => {
          setSignedIn(false);
          setEditing(null);
        }}
        onSignIn={(code) => {
          if (code !== CODE) return false;
          setSignedIn(true);
          return true;
        }}
        onCatalog={setCatalog}
        onHome={setHome}
        onEditing={(id) => {
          setEditing(id);
          setPreview("draft");
        }}
        onProject={(next) => setProjects((current) => current.map((project) => (project.id === next.id ? next : project)))}
        onAdd={addProject}
        onPublishOrder={() => {
          const drop = new Set(removed);
          const nextCatalog = catalog.filter((id) => !drop.has(id));
          const nextHome = home.filter((id) => !drop.has(id));
          setProjects((current) => current.filter((project) => !drop.has(project.id)));
          setSavedProjects((current) => current.filter((project) => !drop.has(project.id)));
          setCatalog(nextCatalog);
          setHome(nextHome);
          setSavedCatalog(nextCatalog);
          setSavedHome(nextHome);
          setHidden((current) => current.filter((id) => !drop.has(id)));
          setRemoved([]);
          if (editing && drop.has(editing)) setEditing(null);
        }}
        onPublishProject={publishProject}
        onPreview={setPreview}
        onHide={(id, next) => setHidden((current) => (next ? [...new Set([...current, id])] : current.filter((item) => item !== id)))}
        onRemove={(id) => setRemoved((current) => (current.includes(id) ? current : [...current, id]))}
        onOpenPage={(id) => {
          setEditing(id);
          setPreview("site");
        }}
        onClearRemoved={() => setRemoved([])}
      />
    </main>
  );
}
