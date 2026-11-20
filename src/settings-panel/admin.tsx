"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CodeField } from "./code-field";
import {
  ChangedName,
  CommandMark,
  DockAnchorContext,
  DockButton,
  DockedWindows,
  FloatWindow,
  IconPick,
  KeyCap,
  KitTheme,
  Menu,
  PanelIcon,
  PanelLocale,
  Pop,
  Row,
  ScreenDock,
  Section,
  SectionFoldContext,
  Segment,
  ValueField,
  dangerFillClass,
  dangerTextClass,
  panelHeightCap,
  rowLabel,
  tr,
  type DockAnchor,
} from "./kit-chrome";
import { samePanelRowOrder } from "../lib/panel-rows";
import { useRowOrderDrag } from "./row-order-drag";
import { usePrefersReducedMotion } from "../lib/prefers-reduced-motion";
import { PROJECT_MENU_WIDTH, ProjectMenu, type ProjectMenuItem } from "./project-menu";
import { ProjectRow } from "./project-row";
import { SectionCollapse } from "./row";
import { TextField } from "./text-field";

const HOVER = "transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";

export type AdminLength = "short" | "full";

export type AdminPhoto = {
  id: string;
  /** Shown when `src` is empty. A CSS color, so the tile reads on the light plate. */
  tone: string;
  /** Width / height. The tile is 120 tall. */
  ratio: number;
  src?: string;
};

export type AdminRole = { name: string; labels: string[] };

/** One project. A site and the playground share this shape; neither is a particular studio. */
export type AdminProject = {
  id: string;
  name: string;
  year: string;
  /** Short hides the paragraph on the page. Full shows it. */
  length: AdminLength;
  slug: string;
  text: string;
  roles: AdminRole[];
  photos: AdminPhoto[];
  status?: "draft" | "hidden";
  tone: string;
  published: boolean;
};

export type AdminPreview = "site" | "draft";

/** Address from a name: lower case, words joined by a hyphen. */
export function adminSlug(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "project";
}

export function uniqueAdminSlug(base: string, taken: readonly string[]) {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function sameProject(a: AdminProject | undefined, b: AdminProject | undefined) {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function projectName(project: AdminProject) {
  return project.name.trim() || "Новый проект";
}

function AdminPublish({
  busy,
  onReset,
  onPublish,
}: {
  busy: boolean;
  onReset: () => void;
  onPublish: () => void;
}) {
  return (
    <span className="flex w-full items-center gap-1">
      <button
        type="button"
        aria-label="Сбросить"
        onClick={onReset}
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border border-black text-black fine-hover:hover:bg-black fine-hover:hover:text-white ${HOVER}`}
      >
        <PanelIcon name="eraser" className="size-5" />
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onPublish}
        className={`flex h-8 min-w-0 flex-1 items-center justify-center rounded-lg border border-black px-2.5 text-[14px] leading-4 text-black fine-hover:hover:bg-black fine-hover:hover:text-white disabled:opacity-50 ${HOVER}`}
      >
        Опубликовать
      </button>
    </span>
  );
}

function ProjectMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} transform="translate(2 2) scale(0.66666667)">
        <path d="M12 3H5C4.46957 3 3.96086 3.21071 3.58579 3.58579C3.21071 3.96086 3 4.46957 3 5V19C3 19.5304 3.21071 20.0391 3.58579 20.4142C3.96086 20.7893 4.46957 21 5 21H19C19.5304 21 20.0391 20.7893 20.4142 20.4142C20.7893 20.0391 21 19.5304 21 19V12M18.375 2.62523C18.7728 2.2274 19.3124 2.00391 19.875 2.00391C20.4376 2.00391 20.9771 2.2274 21.375 2.62523C21.7728 3.02305 21.9963 3.56262 21.9963 4.12523C21.9963 4.68784 21.7728 5.2274 21.375 5.62523L12.362 14.6392C12.1245 14.8765 11.8312 15.0501 11.509 15.1442L8.63597 15.9842C8.54992 16.0093 8.45871 16.0108 8.37188 15.9886C8.28505 15.9663 8.2058 15.9212 8.14242 15.8578C8.07904 15.7944 8.03386 15.7151 8.01162 15.6283C7.98937 15.5415 7.99087 15.4503 8.01597 15.3642L8.85597 12.4912C8.9505 12.1693 9.12451 11.8763 9.36197 11.6392L18.375 2.62523Z" />
      </g>
    </svg>
  );
}

function WindowTitle({
  icon,
  title,
  action,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-5 items-center gap-1">
      {icon}
      <span className="min-w-0 flex-1 truncate text-[14px] leading-4">{title}</span>
      {action}
    </div>
  );
}

type MenuBox = { left: number; right: number; top: number; bottom: number };

function placeMenu(box: MenuBox, align: "cursor" | "button", count: number) {
  const width = PROJECT_MENU_WIDTH;
  const height = count * 24 + 8;
  const margin = 8;
  let left = align === "button" ? box.right - width : box.left;
  let top = align === "button" ? box.bottom + 4 : box.top;
  if (left < margin) left = align === "button" ? box.left : margin;
  if (left + width > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - margin - width);
  if (top + height > window.innerHeight - margin) top = align === "button" ? box.top - 4 - height : box.top - height;
  return { top: Math.max(margin, top), left: Math.max(margin, left) };
}

function adminMenuItems(hidden: boolean, fromRow: boolean): ProjectMenuItem[] {
  const items: ProjectMenuItem[] = [
    { id: "open", label: "Открыть страницу", icon: "link" },
    { id: "hide", label: hidden ? "Опубликовать" : "Снять с сайта", icon: hidden ? "eye" : "eye-off" },
    { id: "delete", label: "Удалить проект", icon: "trash-2", danger: true },
  ];
  if (fromRow) items.unshift({ id: "edit", label: "Редактировать", icon: "folder", glyph: <ProjectMark className="size-5" /> });
  return items;
}

function MenuDots() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
      <g fill="currentColor">
        <circle cx="4.5" cy="10" r="1.15" />
        <circle cx="10" cy="10" r="1.15" />
        <circle cx="15.5" cy="10" r="1.15" />
      </g>
    </svg>
  );
}

function ProjectActionMenu({
  anchor,
  hit,
  hidden,
  fromRow,
  theme,
  onClose,
  onOpen,
  onEdit,
  onHidden,
  onDelete,
}: {
  anchor: { top: number; left: number };
  /** Button or pointer box. The menu stays open while the pointer is on it. */
  hit?: MenuBox;
  hidden: boolean;
  fromRow: boolean;
  theme: "light" | "dark";
  onClose: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onHidden: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const inside = (box: { left: number; right: number; top: number; bottom: number }, x: number, y: number) => {
      const pad = 12;
      return x >= box.left - pad && x <= box.right + pad && y >= box.top - pad && y <= box.bottom + pad;
    };
    const onMove = (event: PointerEvent) => {
      const menu = menuRef.current?.getBoundingClientRect();
      if (!menu) return;
      if (!inside(menu, event.clientX, event.clientY) && !(hit && inside(hit, event.clientX, event.clientY))) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
    };
  }, [hit, onClose]);
  return createPortal(
    <div
      ref={menuRef}
      data-settings-panel=""
      data-new-ui=""
      data-panel-theme={theme}
      className="fixed z-[120]"
      style={{ top: anchor.top, left: anchor.left }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <ProjectMenu
        items={adminMenuItems(hidden, fromRow)}
        onSelect={(id) => {
          onClose();
          if (id === "edit") onEdit();
          else if (id === "open") onOpen();
          else if (id === "hide") onHidden();
          else if (id === "delete") onDelete();
        }}
      />
    </div>,
    document.body,
  );
}

function DeleteProjectDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="delete-project-title" className="w-full max-w-[240px] rounded-2xl bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        <p id="delete-project-title" className="text-center text-[14px] leading-5">Удалить проект?</p>
        <div className="mt-3 flex gap-1">
          <button type="button" autoFocus onClick={onCancel} className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-lg border border-black px-2 text-[14px] leading-4">
            Отмена
          </button>
          <button type="button" onClick={onConfirm} className={`flex h-8 min-w-0 flex-1 items-center justify-center rounded-lg px-2 text-[14px] leading-4 ${dangerFillClass}`}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminProjectList({
  order,
  projects,
  hidden = [],
  removed = [],
  cue = true,
  onOrder,
  onOpen,
  onMenu,
}: {
  order: readonly string[];
  projects: readonly AdminProject[];
  hidden?: readonly string[];
  removed?: readonly string[];
  /** Chevron on hover. The home list does not open a project. */
  cue?: boolean;
  onOrder: (next: string[]) => void;
  onOpen?: (id: string) => void;
  /** Right click opens the same menu as the editor’s three dots. */
  onMenu?: (id: string, x: number, y: number) => void;
}) {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const ids = order.filter((id) => byId.has(id));
  const drag = useRowOrderDrag(ids, onOrder, { lift: "black" });

  return (
    <>
      <div ref={drag.listRef} className="relative flex w-full flex-col rounded-lg bg-black">
        {ids.map((id, index) => {
          const project = byId.get(id);
          if (!project) return null;
          const cover = project.photos[0];
          const gone = removed.includes(id);
          const concealed = hidden.includes(id);
          return (
            <div
              key={id}
              data-sort-id={id}
              onClick={() => {
                if (drag.consumeDrag()) return;
                onOpen?.(id);
              }}
              onContextMenu={(event) => {
                if (!onMenu) return;
                event.preventDefault();
                onMenu(id, event.clientX, event.clientY);
              }}
            >
              <ProjectRow
                title={projectName(project)}
                meta={project.year}
                status={gone ? "removed" : concealed ? "hidden" : project.status ?? (project.published ? undefined : "draft")}
                tone={project.tone}
                image={cover?.src}
                cue={cue}
                edge={index === 0 ? "first" : index === ids.length - 1 ? "last" : undefined}
                onPointerDown={(event) => drag.onPointerDown(id, event)}
              />
            </div>
          );
        })}
      </div>
      {drag.lift}
    </>
  );
}

function RoleCard({
  role,
  catalog,
  onChange,
  onRemove,
  onCatalog,
}: {
  role: AdminRole;
  catalog: readonly string[];
  onChange: (next: AdminRole) => void;
  onRemove: () => void;
  onCatalog: (next: string[]) => void;
}) {
  const [menu, setMenu] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLSpanElement>(null);
  const anchor = useRef<HTMLElement | null>(null);

  function openMenu(target: HTMLElement) {
    const row = chips.current;
    if (!row) return;
    if (menu != null && anchor.current === target) {
      anchor.current = null;
      setMenu(null);
      return;
    }
    const chipBox = target.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    anchor.current = target;
    setMenu(chipBox.bottom - rowBox.top + 4);
  }

  useEffect(() => {
    if (menu == null) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && root.current?.contains(event.target)) return;
      setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <div ref={root} className={`relative w-full ${menu != null ? "z-20" : ""}`}>
      <div className="flex flex-col gap-1.5 rounded-lg bg-black p-1 text-white">
        <span className="flex items-center gap-2">
          <input
            value={role.name}
            aria-label="Имя"
            placeholder="Имя или ник"
            spellCheck={false}
            onChange={(event) => onChange({ ...role, name: event.target.value })}
            className="min-w-0 flex-1 bg-transparent text-[14px] leading-4 text-white outline-none placeholder:text-white/50"
          />
          <button
            type="button"
            aria-label="Удалить"
            onClick={onRemove}
            className="flex size-6 shrink-0 items-center justify-center rounded text-white transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:hover:inset-ring fine-hover:hover:inset-ring-white"
          >
            <PanelIcon name="x" className="size-5" />
          </button>
        </span>
        <span ref={chips} className="relative flex flex-wrap items-center gap-1">
          {role.labels.map((label) => (
            <span key={label} className={`flex h-6 items-center gap-1 rounded border border-white px-1.5 text-[14px] leading-4 text-white fine-hover:hover:bg-white fine-hover:hover:text-black ${HOVER}`}>
              <button type="button" onClick={(event) => openMenu(event.currentTarget.parentElement ?? event.currentTarget)} className="min-w-0">
                {label}
              </button>
              <button
                type="button"
                aria-label={`Убрать ${label}`}
                onClick={() => onChange({ ...role, labels: role.labels.filter((item) => item !== label) })}
                className="flex size-4 items-center justify-center"
              >
                <PanelIcon name="x" className="size-4" strokeWidth={1.75} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={(event) => openMenu(event.currentTarget)}
            className={`flex h-6 items-center gap-1 rounded border border-dashed border-white px-1.5 text-[14px] leading-4 text-white fine-hover:hover:border-solid fine-hover:hover:bg-white fine-hover:hover:text-black ${HOVER}`}
          >
            + Роль
          </button>
          {menu != null ? (
            <div className="absolute left-0 z-30 w-60 overflow-hidden rounded-lg" style={{ top: menu }}>
              <Menu
                options={[...catalog]}
                value=""
                selected={role.labels}
                onChange={(label) =>
                  onChange({
                    ...role,
                    labels: role.labels.includes(label) ? role.labels.filter((item) => item !== label) : [...role.labels, label],
                  })
                }
                onCreate={(label) => {
                  const name = label.trim();
                  if (!name) return;
                  if (!catalog.includes(name)) onCatalog([...catalog, name]);
                  if (!role.labels.includes(name)) onChange({ ...role, labels: [...role.labels, name] });
                }}
                onRemove={(label) => {
                  onCatalog(catalog.filter((item) => item !== label));
                  onChange({ ...role, labels: role.labels.filter((item) => item !== label) });
                }}
              />
            </div>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function EditorBlock({
  title,
  children,
  changed = false,
  onReset,
  count,
}: {
  title: string;
  children: ReactNode;
  changed?: boolean;
  onReset?: () => void;
  count?: number;
}) {
  const [open, setOpen] = useState(true);
  const reduce = usePrefersReducedMotion();
  const motion = reduce ? "" : "transition-[width,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]";
  return (
    <div className="flex shrink-0 flex-col">
      <div className="flex h-4 w-full items-center gap-1">
        {onReset ? (
          <span className={`flex shrink-0 overflow-hidden ${motion}`} style={{ width: changed ? 16 : 0, opacity: changed ? 1 : 0 }}>
            <button type="button" aria-label={`Вернуть ${title}`} tabIndex={changed ? 0 : -1} onClick={onReset} className="flex size-4 shrink-0 items-center justify-center">
              <i className="size-1 rounded-full bg-black" />
            </button>
          </span>
        ) : null}
        <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-4 min-w-0 flex-1 items-center justify-between text-left">
          <span className="text-[14px] leading-4">{title}</span>
          <span className="flex items-center gap-1">
            {count != null ? <span className="text-[11px] leading-4 text-black/50">{count}</span> : null}
            <PanelIcon name={open ? "chevron-up" : "chevron-down"} className="size-5" />
          </span>
        </button>
      </div>
      <SectionCollapse open={open} reduceMotion={reduce}>
        <div className="flex flex-col gap-1.5 pt-1.5">{children}</div>
      </SectionCollapse>
    </div>
  );
}

function PhotoTile({
  photo,
  cover,
  onRemove,
  onCover,
}: {
  photo: AdminPhoto;
  cover: boolean;
  onRemove: () => void;
  onCover: () => void;
}) {
  return (
    <span className="group relative block overflow-hidden rounded" style={{ height: 120, width: Math.round(120 * photo.ratio) }}>
      {photo.src ? (
        <img src={photo.src} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="absolute inset-0" style={{ background: photo.tone }} />
      )}
      {cover ? (
        <span className="absolute bottom-0.5 left-1/2 max-w-[calc(100%-4px)] -translate-x-1/2 rounded-[2px] bg-black p-1 text-[11px] leading-3 text-white [text-box:trim-both_cap_alphabetic]">
          Обложка
        </span>
      ) : (
        <button
          type="button"
          onClick={onCover}
          className="absolute bottom-0.5 left-1/2 w-max max-w-[calc(100%-4px)] -translate-x-1/2 rounded bg-black px-1 py-1 text-center text-[11px] leading-3 text-white opacity-0 [text-box:trim-both_cap_alphabetic] fine-hover:hover:bg-white fine-hover:hover:text-black group-hover:opacity-100"
        >
          Сделать обложкой
        </button>
      )}
      <button
        type="button"
        aria-label="Удалить"
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-[3px] bg-black text-white opacity-0 fine-hover:hover:bg-white fine-hover:hover:text-black group-hover:opacity-100"
      >
        <PanelIcon name="x" className="size-3" strokeWidth={1.75} />
      </button>
    </span>
  );
}

function readPhoto(file: File) {
  return new Promise<AdminPhoto>((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        id: crypto.randomUUID(),
        src,
        tone: "#8FA4B8",
        ratio: image.naturalWidth / Math.max(1, image.naturalHeight),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("image"));
    };
    image.src = src;
  });
}

function ProjectEditor({
  project,
  saved,
  taken,
  preview,
  busy,
  height,
  maxHeight,
  confirming,
  onChange,
  onClose,
  onMenu,
  onPreview,
  onPublish,
  onCancelDelete,
  onConfirmDelete,
}: {
  project: AdminProject;
  saved: AdminProject | undefined;
  taken: readonly string[];
  preview: AdminPreview;
  busy: boolean;
  height?: number;
  maxHeight: number;
  confirming: boolean;
  onChange: (next: AdminProject) => void;
  onClose: () => void;
  onMenu: (box: DOMRect) => void;
  onPreview: (mode: AdminPreview) => void;
  onPublish: (next: AdminProject) => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const dirty = !sameProject(project, saved);
  const status =
    project.published && dirty ? "на сайте · есть изменения" : project.published ? "на сайте" : "есть изменения";
  const linkTaken = project.slug !== "" && taken.includes(project.slug);

  function changeName(name: string) {
    const next = { ...project, name };
    if (project.slug === "" || project.slug === adminSlug(project.name)) {
      next.slug = uniqueAdminSlug(adminSlug(name), taken);
    }
    onChange(next);
  }

  return (
    <section style={{ height, maxHeight }} className="relative flex min-h-0 w-full flex-col overflow-hidden rounded-2xl bg-white text-black">
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${confirming ? "pointer-events-none blur-md" : ""}`}>
      <div className="shrink-0 px-2 pt-2">
        <WindowTitle
          icon={<ProjectMark className="size-5 shrink-0" />}
          title={projectName(project)}
          action={
            <>
              <button
                ref={menuButton}
                type="button"
                data-project-menu=""
                aria-label="Ещё"
                onClick={() => {
                  const box = menuButton.current?.getBoundingClientRect();
                  if (box) onMenu(box);
                }}
                className="flex size-5 shrink-0 items-center justify-center"
              >
                <MenuDots />
              </button>
              <button type="button" aria-label="Закрыть" onClick={onClose} className="flex size-5 shrink-0 items-center justify-center">
                <PanelIcon name="x" className="size-5" />
              </button>
            </>
          }
        />
      </div>
      <div className="mx-2 mt-1.5 flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
        {project.published ? (
          <Row>
            <span className={rowLabel}>Просмотр</span>
            <Segment<AdminPreview>
              value={preview}
              onChange={onPreview}
              options={[
                { id: "site", label: "На сайте" },
                { id: "draft", label: "Черновик" },
              ]}
            />
          </Row>
        ) : null}
        <EditorBlock title="Инфо">
          <div className="overflow-hidden rounded-lg bg-black [&_[data-row]]:rounded-none">
            <Row>
              <span className={rowLabel}>Статус</span>
              <span className="text-[14px] leading-[18px] text-white/50">{status}</span>
            </Row>
            <Row>
              <ChangedName changed={saved != null && project.length !== saved.length} label="Показ" onReset={() => saved && onChange({ ...project, length: saved.length })} />
              <Segment<AdminLength>
                value={project.length}
                onChange={(length) => onChange({ ...project, length })}
                options={[
                  { id: "short", label: "Коротко" },
                  { id: "full", label: "Полностью" },
                ]}
              />
            </Row>
            <Row>
              <ChangedName changed={saved != null && project.name !== saved.name} label="Название" onReset={() => saved && onChange({ ...project, name: saved.name, slug: saved.slug })} />
              <input
                value={project.name}
                aria-label="Название"
                onChange={(event) => changeName(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-right text-[14px] leading-[18px] text-white outline-none"
              />
            </Row>
            <Row>
              <ChangedName changed={saved != null && project.year !== saved.year} label="Год" onReset={() => saved && onChange({ ...project, year: saved.year })} />
              <ValueField
                value={project.year || "0"}
                current={Number(project.year) || 0}
                min={0}
                max={9999}
                step={1}
                onCommit={(year) => onChange({ ...project, year: year.replace(/\D/g, "").slice(0, 4) })}
              />
            </Row>
            <TextField
              label="Текст"
              placeholder="Текст"
              plain
              value={project.text}
              rows={5}
              changed={saved != null && project.text !== saved.text}
              onReset={() => saved && onChange({ ...project, text: saved.text })}
              onChange={(text) => onChange({ ...project, text })}
            />
          </div>
        </EditorBlock>
        <EditorBlock
          title="Участники"
          count={project.roles.length}
          changed={saved != null && JSON.stringify(project.roles) !== JSON.stringify(saved.roles)}
          onReset={() => saved && onChange({ ...project, roles: saved.roles })}
        >
          {project.roles.map((role, index) => (
            <RoleCard
              key={index}
              role={role}
              catalog={catalog}
              onCatalog={setCatalog}
              onChange={(next) => onChange({ ...project, roles: project.roles.map((item, at) => (at === index ? next : item)) })}
              onRemove={() => onChange({ ...project, roles: project.roles.filter((_, at) => at !== index) })}
            />
          ))}
          <button
            type="button"
            aria-label="Добавить участника"
            onClick={() => onChange({ ...project, roles: [...project.roles, { name: "", labels: [] }] })}
            className={`relative flex w-full shrink-0 flex-col gap-1.5 rounded-lg p-1 text-black outline outline-1 -outline-offset-1 outline-dashed outline-black fine-hover:hover:bg-black fine-hover:hover:text-white fine-hover:hover:outline-solid ${HOVER}`}
          >
            <span className="h-6" aria-hidden />
            <span className="h-6" aria-hidden />
            <PanelIcon name="plus" className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2" />
          </button>
        </EditorBlock>
        <EditorBlock
          title="Загруженные фото"
          count={project.photos.length}
          changed={saved != null && JSON.stringify(project.photos) !== JSON.stringify(saved.photos)}
          onReset={() => saved && onChange({ ...project, photos: saved.photos })}
        >
          {project.photos.length > 0 ? (
            <span className="flex flex-wrap items-start gap-2">
              {project.photos.map((photo, index) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  cover={index === 0}
                  onRemove={() => {
                    if (photo.src?.startsWith("blob:")) URL.revokeObjectURL(photo.src);
                    onChange({ ...project, photos: project.photos.filter((item) => item.id !== photo.id) });
                  }}
                  onCover={() => onChange({ ...project, photos: [photo, ...project.photos.filter((item) => item.id !== photo.id)] })}
                />
              ))}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
              void Promise.all(files.map(readPhoto)).then(
                (added) => onChange({ ...project, photos: [...project.photos, ...added] }),
                () => setFailed(true),
              );
            }}
            className={`relative h-20 w-full shrink-0 rounded border border-dashed border-black text-black fine-hover:hover:border-solid fine-hover:hover:bg-black fine-hover:hover:text-white ${HOVER}`}
          >
            <PanelIcon name="plus" className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2" />
            <span className="absolute top-[calc(50%+14px)] left-1/2 w-max max-w-[calc(100%-16px)] -translate-x-1/2 text-center text-[11px] leading-4 opacity-50">
              Перетащите медиа или нажмите
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              void Promise.all(files.map(readPhoto)).then(
                (added) => onChange({ ...project, photos: [...project.photos, ...added] }),
                () => setFailed(true),
              );
            }}
          />
        </EditorBlock>
        <div className="h-2 shrink-0" />
      </div>
      {dirty ? (
        <div className="shrink-0 px-2 pt-2 pb-2">
          <AdminPublish
            busy={busy || linkTaken || project.slug === ""}
            onReset={() => saved && onChange(saved)}
            onPublish={() => {
              if (linkTaken || project.slug === "") {
                setFailed(true);
                return;
              }
              setFailed(false);
              onPublish({ ...project, published: true, status: undefined });
            }}
          />
        </div>
      ) : null}
      {failed ? <p className="px-2 pb-2 text-[14px] leading-4 text-black/50">Не удалось сохранить</p> : null}
      </div>
      {confirming ? <DeleteProjectDialog onCancel={onCancelDelete} onConfirm={onConfirmDelete} /> : null}
    </section>
  );
}

function Gate({
  attempt,
  error,
  locale,
  onSubmit,
}: {
  attempt: number;
  error: boolean;
  locale: "ru" | "en";
  onSubmit: (code: string) => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue("");
    document.querySelector<HTMLInputElement>("[data-admin-gate] input")?.focus();
  }, [attempt]);

  const hint = value.length > 0 ? null : error ? tr(locale, "Неверный код", "Wrong code") : tr(locale, "Введите код", "Enter the code");

  return (
    <section data-admin-gate="" className="flex w-[300px] flex-col gap-1.5 rounded-2xl bg-white p-2 text-black">
      <WindowTitle icon={<PanelIcon name="lock" className="size-5 shrink-0" />} title={tr(locale, "Вход", "Sign in")} />
      <CodeField
        key={attempt}
        onChange={(code) => {
          setValue(code);
          onSubmit(code);
        }}
      />
      {hint ? (
        <p className={`px-1 text-[14px] leading-4 ${error ? dangerTextClass : "text-black/50"}`}>{hint}</p>
      ) : null}
    </section>
  );
}

/**
 * Gate, project list, pages and editor.
 * The app passes the catalog and checks the code. Sign-in, order and publish stay there.
 */
export function AdminShell({
  signedIn,
  theme,
  locale,
  projects,
  savedProjects,
  catalog,
  home,
  savedCatalog,
  savedHome,
  editing,
  preview,
  hidden,
  removed,
  onTheme,
  onLocale,
  onLeave,
  onSignIn,
  onCatalog,
  onHome,
  onEditing,
  onProject,
  onAdd,
  onPublishOrder,
  onPublishProject,
  onPreview,
  onHide,
  onRemove,
  onOpenPage,
  onClearRemoved,
}: {
  signedIn: boolean;
  theme: "light" | "dark";
  locale: "ru" | "en";
  projects: readonly AdminProject[];
  savedProjects: readonly AdminProject[];
  catalog: readonly string[];
  home: readonly string[];
  savedCatalog: readonly string[];
  savedHome: readonly string[];
  editing: string | null;
  preview: AdminPreview;
  /** Ids kept in the list and off the public site. */
  hidden: readonly string[];
  /** Ids marked for deletion until the list is published. */
  removed: readonly string[];
  onTheme: (next: "light" | "dark") => void;
  onLocale: (next: "ru" | "en") => void;
  onLeave: () => void;
  /** `false` keeps the gate and shows the error. */
  onSignIn: (code: string) => boolean;
  onCatalog: (next: string[]) => void;
  onHome: (next: string[]) => void;
  onEditing: (id: string | null) => void;
  onProject: (next: AdminProject) => void;
  onAdd: () => void;
  onPublishOrder: () => void;
  onPublishProject: (next: AdminProject) => void;
  onPreview: (mode: AdminPreview) => void;
  onHide: (id: string, hidden: boolean) => void;
  onRemove: (id: string) => void;
  onOpenPage: (id: string) => void;
  onClearRemoved: () => void;
}) {
  const [dockAnchor, setDockAnchor] = useState<DockAnchor | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [homeOpen, setHomeOpen] = useState(true);
  const [pageClosed, setPageClosed] = useState<ReadonlySet<string>>(() => new Set(["page"]));
  const [placeEpoch, setPlaceEpoch] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editorBox, setEditorBox] = useState<{ width: number; height?: number }>({ width: 300 });
  const [menu, setMenu] = useState<{ id: string; top: number; left: number; hit: MenuBox; fromRow: boolean } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const room = panelHeightCap(dockAnchor);
  const tt = (ru: string, en: string) => (locale === "en" ? en : ru);
  const catalogDirty = !samePanelRowOrder(catalog, savedCatalog) || removed.length > 0;
  const homeDirty = !samePanelRowOrder(home, savedHome) || removed.length > 0;

  function openMenu(id: string, box: MenuBox, align: "cursor" | "button") {
    const next = { id, hit: box, fromRow: align === "cursor", ...placeMenu(box, align, adminMenuItems(hidden.includes(id), align === "cursor").length) };
    setMenu((current) => (align === "button" && current?.id === id ? null : next));
  }

  function confirmDelete() {
    if (!confirmId) return;
    onRemove(confirmId);
    if (editing === confirmId) onEditing(null);
    setConfirmId(null);
  }
  const project = projects.find((item) => item.id === editing) ?? null;
  const saved = savedProjects.find((item) => item.id === editing);
  const taken = projects.filter((item) => item.id !== editing).map((item) => item.slug);

  function submit(code: string) {
    if (code.length < 6) {
      setError(false);
      return;
    }
    if (!onSignIn(code)) {
      setError(true);
      setAttempt((current) => current + 1);
      return;
    }
    setError(false);
    setListOpen(true);
  }

  return (
    <PanelLocale.Provider value={locale}>
      <KitTheme theme={theme}>
        <DockAnchorContext.Provider value={dockAnchor}>
          <ScreenDock onAnchor={setDockAnchor}>
            <DockButton name="log-out" label="Выйти" onClick={onLeave} />
            <span className="h-4 w-0.5 rounded-full bg-black/50" />
            <DockButton
              name="settings"
              label={tt("Настройки панели", "Panel settings")}
              active={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            />
            {signedIn ? (
              <>
                <DockButton
                  name="sliders-horizontal"
                  label={tt("Страницы", "Pages")}
                  active={pagesOpen}
                  onClick={() => setPagesOpen((open) => !open)}
                />
                <DockButton name="folder" label="Проекты" active={listOpen} onClick={() => setListOpen((open) => !open)} />
              </>
            ) : (
              <DockButton name="lock" label={tt("Вход", "Sign in")} active={gateOpen} onClick={() => setGateOpen((open) => !open)} />
            )}
          </ScreenDock>
          <DockedWindows>
            <FloatWindow resetKey={placeEpoch} hidden={signedIn ? !listOpen : !gateOpen}>
              {signedIn ? (
                <section className="flex w-[300px] flex-col gap-1.5 rounded-2xl bg-white p-2 text-black">
                  <WindowTitle
                    icon={<PanelIcon name="folder" className="size-5 shrink-0" />}
                    title="Проекты"
                    action={
                      <button type="button" aria-label={tt("Добавить проект", "Add project")} onClick={onAdd} className="flex size-5 shrink-0 items-center justify-center">
                        <PanelIcon name="plus" className="size-5" />
                      </button>
                    }
                  />
                  <AdminProjectList
                    order={catalog}
                    projects={projects}
                    hidden={hidden}
                    removed={removed}
                    onOrder={onCatalog}
                    onOpen={onEditing}
                    onMenu={(id, x, y) => openMenu(id, { left: x, right: x, top: y, bottom: y }, "cursor")}
                  />
                  {catalogDirty ? <AdminPublish busy={busy} onReset={() => { onCatalog([...savedCatalog]); onClearRemoved(); }} onPublish={() => { setBusy(true); onPublishOrder(); setBusy(false); }} /> : null}
                </section>
              ) : (
                <Gate attempt={attempt} error={error} locale={locale} onSubmit={submit} />
              )}
            </FloatWindow>
            <FloatWindow
              resetKey={placeEpoch}
              hidden={!signedIn || !project}
              style={{ width: editorBox.width, height: editorBox.height == null ? undefined : Math.min(editorBox.height, room), maxHeight: room }}
              resizable={{
                minWidth: 300,
                maxWidth: 560,
                minHeight: 240,
                maxHeight: room,
                onResize: ({ width, height }) => {
                  setEditorBox((current) => ({ width: width ?? current.width, height: height ?? current.height }));
                },
              }}
            >
              <Pop open={Boolean(signedIn && project)}>
                {project ? (
                  <ProjectEditor
                    project={project}
                    saved={saved}
                    taken={taken}
                    preview={preview}
                    busy={busy}
                    height={editorBox.height == null ? undefined : Math.min(editorBox.height, room)}
                    maxHeight={room}
                    confirming={confirmId === project.id}
                    onChange={onProject}
                    onClose={() => onEditing(null)}
                    onMenu={(box) => openMenu(project.id, box, "button")}
                    onPreview={onPreview}
                    onCancelDelete={() => setConfirmId(null)}
                    onConfirmDelete={confirmDelete}
                    onPublish={(next) => {
                      setBusy(true);
                      onPublishProject(next);
                      setBusy(false);
                    }}
                  />
                ) : null}
              </Pop>
            </FloatWindow>
            <FloatWindow resetKey={placeEpoch} hidden={!signedIn || !pagesOpen}>
              <Pop open={pagesOpen && signedIn}>
                <section className="flex max-h-[calc(100vh-80px)] w-[308px] flex-col gap-2 rounded-2xl bg-white p-2 text-black">
                  <WindowTitle icon={<PanelIcon name="sliders-horizontal" className="size-5 shrink-0" />} title={tt("Страницы", "Pages")} />
                  <div className="flex min-h-0 flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button type="button" onClick={() => setHomeOpen((open) => !open)} className="flex h-4 w-full items-center justify-between text-left">
                      <span className="text-[14px] leading-4">{tt("Главная", "Home")}</span>
                      <PanelIcon name={homeOpen ? "chevron-up" : "chevron-down"} className="size-5" />
                    </button>
                    {homeOpen ? (
                      <div className="mt-1.5">
                        <AdminProjectList
                          order={home}
                          projects={projects}
                          hidden={hidden}
                          removed={removed}
                          cue={false}
                          onOrder={onHome}
                          onMenu={(id, x, y) => openMenu(id, { left: x, right: x, top: y, bottom: y }, "cursor")}
                        />
                      </div>
                    ) : null}
                    <div className="mt-1.5">
                      <SectionFoldContext.Provider
                        value={{
                          closed: pageClosed,
                          toggle: (id) =>
                            setPageClosed((current) => {
                              const next = new Set(current);
                              if (next.has(id)) next.delete(id);
                              else next.add(id);
                              return next;
                            }),
                        }}
                      >
                        <Section foldId="page" title="Страница">{null}</Section>
                      </SectionFoldContext.Provider>
                    </div>
                  </div>
                  {homeDirty ? (
                    <div className="shrink-0">
                      <AdminPublish busy={busy} onReset={() => { onHome([...savedHome]); onClearRemoved(); }} onPublish={() => { setBusy(true); onPublishOrder(); setBusy(false); }} />
                    </div>
                  ) : null}
                </section>
              </Pop>
            </FloatWindow>
            <FloatWindow resetKey={placeEpoch}>
              <Pop open={settingsOpen}>
                <section data-chrome="" className="flex w-64 flex-col gap-2 rounded-2xl bg-white p-2 text-black">
                  <Section title={tt("Внешний вид", "Appearance")} icon="contrast">
                    <Row>
                      <span className={rowLabel}>{tt("Язык", "Language")}</span>
                      <Segment<"ru" | "en">
                        value={locale}
                        onChange={onLocale}
                        options={[
                          { id: "ru", label: "Ru" },
                          { id: "en", label: "Eng" },
                        ]}
                      />
                    </Row>
                    <Row>
                      <span className={rowLabel}>{tt("Тема", "Theme")}</span>
                      <IconPick
                        value={theme === "dark" ? "moon" : "sun"}
                        onChange={(next) => onTheme(next === "moon" ? "dark" : "light")}
                        options={[
                          { id: "sun", icon: "sun" },
                          { id: "moon", icon: "moon" },
                        ]}
                      />
                    </Row>
                    <Row>
                      <span className={rowLabel}>{tt("Положение", "Position")}</span>
                      <button type="button" onClick={() => setPlaceEpoch((value) => value + 1)} className="h-6 rounded bg-white px-2 text-[14px] text-black">
                        {tt("Сбросить", "Reset")}
                      </button>
                    </Row>
                  </Section>
                  <Section title={tt("Хоткеи", "Hotkeys")} icon="keyboard">
                    <Row>
                      <span className={rowLabel}>{tt("Скрыть бар", "Hide bar")}</span>
                      <span className="flex items-center gap-1">
                        <KeyCap><CommandMark /></KeyCap>
                        <KeyCap>\</KeyCap>
                      </span>
                    </Row>
                    <Row>
                      <span className={rowLabel}>{tt("Отменить", "Undo")}</span>
                      <span className="flex items-center gap-1">
                        <KeyCap><CommandMark /></KeyCap>
                        <KeyCap>Z</KeyCap>
                      </span>
                    </Row>
                  </Section>
                </section>
              </Pop>
            </FloatWindow>
          </DockedWindows>
          {menu ? (
            <ProjectActionMenu
              anchor={menu}
              hit={menu.hit}
              hidden={hidden.includes(menu.id)}
              fromRow={menu.fromRow}
              theme={theme}
              onClose={() => setMenu(null)}
              onEdit={() => onEditing(menu.id)}
              onOpen={() => onOpenPage(menu.id)}
              onHidden={() => onHide(menu.id, !hidden.includes(menu.id))}
              onDelete={() => setConfirmId(menu.id)}
            />
          ) : null}
          {confirmId && confirmId !== editing
            ? createPortal(
                <div className="fixed inset-0 z-[130]">
                  <DeleteProjectDialog onCancel={() => setConfirmId(null)} onConfirm={confirmDelete} />
                </div>,
                document.body,
              )
            : null}
        </DockAnchorContext.Provider>
      </KitTheme>
    </PanelLocale.Provider>
  );
}
