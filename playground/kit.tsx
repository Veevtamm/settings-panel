import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DOCK_DRAG_PX, EASE_OUT, SECTION_MS, bindPointerDrag } from "../src/settings-panel/chrome";
import { movePanelRow, panelRowSlot, samePanelRowOrder } from "../src/lib/panel-rows";
import { PairGlyph } from "../src/settings-panel/number";
import { PanelIcon } from "../src/panel-icon";
import { CodeField } from "../src/settings-panel/code-field";
import { TextField } from "../src/settings-panel/text-field";
import { ProjectRow } from "../src/settings-panel/project-row";
import { PageBar } from "./page-bar";
import type { AxisHandle } from "../src/lib/axis-curve";
import {
  AnchorPick,
  AxisWindow,
  ChangedName,
  ColorPicker,
  CommandMark,
  CoordChip,
  DockButton,
  GapChips,
  IconPick,
  KeyCap,
  Menu,
  MotionWindow,
  PickGlyph,
  ParametersPanel,
  Row,
  RowHint,
  Section,
  SectionFoldContext,
  Segment,
  StepMark,
  Toast,
  Track,
  ValueField,
  type Anchor,
  type ColorFormat,
  type Hsva,
} from "../src/settings-panel/kit-ui";

const FONT = '"ABC Areal Variable", "ABC Areal", "Geist", ui-sans-serif, system-ui, sans-serif';

function Card({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex w-max max-w-full flex-col gap-2">
      <h4 className="px-1 text-[14px] leading-4 text-white/50">{name}</h4>
      {children}
    </div>
  );
}

function Band({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="px-1 text-[15px] leading-5">{name}</h3>
      <div className="flex flex-wrap items-start gap-8">{children}</div>
    </section>
  );
}

function Layer({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-8">
      <h2 className="px-1 text-[20px] leading-6">{name}</h2>
      {children}
    </section>
  );
}

function Plate({ children, hug = false }: { children: ReactNode; hug?: boolean }) {
  return <div className={`flex flex-col gap-1 rounded-2xl bg-white p-2 text-black ${hug ? "w-max max-w-full" : "w-[296px]"}`}>{children}</div>;
}

const PROJECTS: { title: string; meta: string; status?: "draft" | "hidden"; tone: string }[] = [
  { title: "Project One", meta: "campaign — 2020", tone: "bg-white/35" },
  { title: "Project With a Long Name", meta: "editorial — 2025", tone: "bg-white/25" },
  { title: "Draft Project", meta: "campaign — 2024", status: "draft", tone: "bg-white/45" },
  { title: "Project Four", meta: "commercial — 2025", tone: "bg-white/20" },
  { title: "Untitled", meta: "— 2026", status: "hidden", tone: "bg-white/10" },
];

function PhotoTile({
  number,
  cover = false,
  makeCover = false,
  ratio = 4 / 5,
  onPointerDown,
}: {
  number?: string;
  cover?: boolean;
  makeCover?: boolean;
  ratio?: number;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <span
      data-chrome=""
      onPointerDown={onPointerDown}
      className="group relative block cursor-grab touch-none overflow-hidden rounded select-none"
      style={{ height: 120, width: Math.round(120 * ratio) }}
    >
      <span data-truecolor="" className="absolute inset-0 bg-[#737373]" />
      {number ? (
        <span className="absolute top-0.5 left-0.5 rounded-[2px] bg-black p-1 text-[11px] leading-3 text-white [text-box:trim-both_cap_alphabetic]">
          {number}
        </span>
      ) : null}
      {cover ? (
        <span className="absolute bottom-0.5 left-1/2 max-w-[calc(100%-4px)] -translate-x-1/2 rounded-[2px] bg-black p-1 text-[11px] leading-3 text-white [text-box:trim-both_cap_alphabetic]">
          Обложка
        </span>
      ) : null}
      <button
        type="button"
        aria-label="Удалить"
        className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-[3px] bg-black text-white opacity-0 fine-hover:hover:bg-white fine-hover:hover:text-black group-hover:opacity-100"
      >
        <PanelIcon name="x" className="size-3" strokeWidth={1.75} />
      </button>
      {makeCover ? (
        <button
          type="button"
          className="absolute bottom-0.5 left-1/2 w-max max-w-[calc(100%-4px)] -translate-x-1/2 rounded bg-black px-1 py-1 text-center text-[11px] leading-3 text-white opacity-0 [text-box:trim-both_cap_alphabetic] fine-hover:hover:bg-white fine-hover:hover:text-black group-hover:opacity-100"
        >
          Сделать обложкой
        </button>
      ) : null}
    </span>
  );
}

const PHOTO_ROW = [
  { id: "01", number: "01", ratio: 9 / 16 },
  { id: "02", number: "02", ratio: 2 / 3 },
  { id: "03", number: "03", ratio: 3 / 4 },
  { id: "04", number: "04", cover: true, ratio: 4 / 5 },
  { id: "05", number: "05", ratio: 1 },
  { id: "06", number: "06", ratio: 4 / 3 },
  { id: "07", number: "07", ratio: 3 / 2 },
  { id: "08", number: "08", ratio: 16 / 9 },
];

function PhotoRow() {
  const [photos, setPhotos] = useState(PHOTO_ROW);
  const orderRef = useRef(photos.map((item) => item.id));
  orderRef.current = photos.map((item) => item.id);
  const listRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const liftPlaceRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const sourceRef = useRef<HTMLElement | null>(null);
  const flipFrom = useRef<Map<string, number> | null>(null);
  const [lift, setLift] = useState<{ html: string; width: number; height: number } | null>(null);

  function placeLift(x: number, y: number) {
    const place = liftPlaceRef.current;
    const node = liftRef.current;
    if (!place || !node) return;
    place.x = x;
    place.y = y;
    node.style.left = `${x - place.offsetX}px`;
    node.style.top = `${y - place.offsetY}px`;
  }

  useLayoutEffect(() => {
    const place = liftPlaceRef.current;
    if (!lift || !place) return;
    placeLift(place.x, place.y);
  }, [lift]);

  useLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    const root = listRef.current;
    if (!from || !root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const nodes: HTMLElement[] = [];
    for (const node of root.querySelectorAll<HTMLElement>("[data-sort-id]")) {
      if (node.hasAttribute("data-tl-lift")) continue;
      const prev = from.get(node.dataset.sortId ?? "");
      if (prev == null) continue;
      const dx = prev - node.getBoundingClientRect().left;
      if (Math.abs(dx) < 0.5) continue;
      node.style.transition = "none";
      node.style.transform = `translateX(${dx}px)`;
      nodes.push(node);
    }
    if (nodes.length === 0) return;
    root.getBoundingClientRect();
    for (const node of nodes) {
      node.style.transition = `transform ${SECTION_MS}ms ${EASE_OUT}`;
      node.style.transform = "";
    }
    const clear = window.setTimeout(() => {
      for (const node of nodes) node.style.transition = "";
    }, SECTION_MS);
    return () => window.clearTimeout(clear);
  }, [photos]);

  function shiftOrder(next: string[]) {
    const root = listRef.current;
    const from = new Map<string, number>();
    if (root) {
      for (const node of root.querySelectorAll<HTMLElement>("[data-sort-id]")) {
        from.set(node.dataset.sortId ?? "", node.getBoundingClientRect().left);
      }
    }
    flipFrom.current = from;
    setPhotos((list) => {
      const byId = new Map(list.map((item) => [item.id, item]));
      return next.flatMap((id) => {
        const item = byId.get(id);
        return item ? [item] : [];
      });
    });
  }

  function onPointerDown(id: string, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    if ((event.target as Element).closest("button")) return;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    bindPointerDrag(pointerId, {
      onMove(ev) {
        if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DOCK_DRAG_PX) return;
        const root = listRef.current;
        const item = root?.querySelector<HTMLElement>(`[data-sort-id="${CSS.escape(id)}"]`);
        if (!root || !item) return;
        if (!moved) {
          moved = true;
          document.documentElement.dataset.phaseDrag = "grab";
          const rect = item.getBoundingClientRect();
          liftPlaceRef.current = {
            x: ev.clientX,
            y: ev.clientY,
            offsetX: ev.clientX - rect.left,
            offsetY: ev.clientY - rect.top,
          };
          sourceRef.current = item;
          item.dataset.tlLift = "";
          setLift({ html: item.innerHTML, width: rect.width, height: rect.height });
        } else {
          placeLift(ev.clientX, ev.clientY);
        }
        const origin = root.getBoundingClientRect().left;
        const boxes = [...root.children]
          .filter((node): node is HTMLElement => node instanceof HTMLElement && node.hasAttribute("data-sort-id"))
          .map((node) => ({
            id: node.dataset.sortId ?? "",
            top: origin + node.offsetLeft,
            bottom: origin + node.offsetLeft + node.offsetWidth,
          }));
        const hit = panelRowSlot(boxes, id, ev.clientX);
        const current = orderRef.current.filter((itemId) => boxes.some((box) => box.id === itemId));
        const next = hit ? movePanelRow(current, id, hit.index) : current;
        if (hit && !samePanelRowOrder(current, next)) shiftOrder(next);
      },
      onEnd() {
        delete document.documentElement.dataset.phaseDrag;
        if (sourceRef.current) delete sourceRef.current.dataset.tlLift;
        sourceRef.current = null;
        liftPlaceRef.current = null;
        setLift(null);
      },
    });
  }

  return (
    <>
      <div ref={listRef} className="relative flex items-start gap-2">
        {photos.map((photo) => (
          <div key={photo.id} data-sort-id={photo.id}>
            <PhotoTile
              number={photo.number}
              cover={photo.cover}
              makeCover={!photo.cover}
              ratio={photo.ratio}
              onPointerDown={(event) => onPointerDown(photo.id, event)}
            />
          </div>
        ))}
      </div>
      {lift
        ? createPortal(
            <div
              ref={liftRef}
              className="pointer-events-none fixed z-[110] origin-top-left scale-[1.03] overflow-hidden rounded shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
              style={{ width: lift.width, height: lift.height }}
              dangerouslySetInnerHTML={{ __html: lift.html }}
            />,
            document.body,
          )
        : null}
    </>
  );
}

const ADD_CAPTION = "absolute top-[calc(50%+14px)] left-1/2 w-max -translate-x-1/2 text-center text-[11px] leading-4";

function AddPhoto({ empty = false, progress, index, total }: { empty?: boolean; progress?: number; index?: number; total?: number }) {
  const loading = progress != null;
  const caption = index != null && total != null ? `${index} из ${total}` : `${progress}%`;
  return (
    <button
      type="button"
      aria-label={empty || loading ? undefined : "Добавить медиа"}
      aria-busy={loading || undefined}
      data-chrome=""
      className={`relative h-20 rounded border border-dashed border-black text-black fine-hover:hover:border-solid fine-hover:hover:bg-black fine-hover:hover:text-white ${CHIP_HOVER} ${empty ? "w-[284px]" : "w-16"}`}
    >
      {loading ? (
        <>
          <span className="absolute top-1/2 left-1/2 h-1 w-[calc(100%-16px)] max-w-40 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-current/20" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={index != null && total != null ? `Загрузка, ${caption}` : "Загрузка"}>
            <span className="block h-full bg-current" style={{ width: `${progress}%` }} />
          </span>
          <span className={`${ADD_CAPTION} max-w-[calc(100%-8px)]`}>{caption}</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 16 16" className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2" aria-hidden>
            <path fill="currentColor" d="M7 3h2v10H7zM3 7h10v2H3z" />
          </svg>
          {empty ? <span className={`${ADD_CAPTION} max-w-[calc(100%-16px)] opacity-50`}>Перетащите медиа или нажмите</span> : null}
        </>
      )}
    </button>
  );
}

const ROLE_LIST = ["Photography", "Styling", "Makeup", "Hair", "Casting"];

const CHIP_HOVER = "transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";

function chipClass(pressed: boolean) {
  const face = pressed
    ? "bg-white text-black fine-hover:hover:bg-black fine-hover:hover:text-white"
    : "text-white fine-hover:hover:bg-white fine-hover:hover:text-black";
  return `flex h-6 items-center gap-1 rounded border border-white px-1.5 text-[14px] leading-4 disabled:opacity-40 ${CHIP_HOVER} ${face}`;
}

function TextSpecimen() {
  const [essay, setEssay] = useState("A spring campaign inspired by 90s films and created on the streets of St. Petersburg.");
  return (
    <span className="block w-[284px] overflow-hidden rounded-lg bg-black">
      <TextField label="Текст" placeholder="Текст" caption={false} plain value={essay} rows={5} onChange={setEssay} />
    </span>
  );
}

function ProjectHeader() {
  return (
    <div className="flex h-8 w-[284px] items-center justify-between text-black">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[14px] leading-4">Saint Valentine</span>
        <span className="text-[11px] leading-3 text-black/45">на сайте · есть неопубликованное</span>
      </span>
      <button type="button" aria-label="Закрыть" className="flex size-4 shrink-0 items-center justify-center">
        <PanelIcon name="x" className="size-4" />
      </button>
    </div>
  );
}

function PasswordField() {
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(false);
  return (
    <span className="flex h-8 w-[284px] items-center gap-2 rounded-lg bg-black px-2 text-white">
      <input
        type={shown ? "text" : "password"}
        value={value}
        autoComplete="current-password"
        placeholder="Пароль"
        aria-label="Пароль"
        onChange={(event) => setValue(event.target.value)}
        className={`min-w-0 flex-1 bg-transparent text-[14px] leading-4 text-white outline-none placeholder:text-white/50 ${value ? "underline decoration-1 underline-offset-[3px]" : ""}`}
      />
      <button
        type="button"
        aria-label={shown ? "Скрыть пароль" : "Показать пароль"}
        aria-pressed={shown}
        onClick={() => setShown((current) => !current)}
        className="flex size-4 shrink-0 items-center justify-center"
      >
        <PanelIcon name={shown ? "eye-off" : "eye"} className="size-4" />
      </button>
    </span>
  );
}

function AdminButton({ children, label, fill = false }: { children: ReactNode; label?: string; fill?: boolean }) {
  const face = "border border-black text-black fine-hover:hover:bg-black fine-hover:hover:text-white";
  const box = label ? "size-8 shrink-0 justify-center" : fill ? "h-8 min-w-0 flex-1 justify-center px-2.5" : "h-8 px-2.5";
  return (
    <button type="button" aria-label={label} className={`flex items-center rounded-lg text-[14px] leading-4 ${box} ${CHIP_HOVER} ${face}`}>
      {children}
    </button>
  );
}

function Credit() {
  const [present, setPresent] = useState(true);
  const [handle, setHandle] = useState("username");
  const [catalog, setCatalog] = useState(ROLE_LIST);
  const [roles, setRoles] = useState(["Photography", "Styling"]);
  const [menu, setMenu] = useState(false);
  const [menuTop, setMenuTop] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLSpanElement>(null);
  const anchor = useRef<HTMLElement | null>(null);
  function openMenu(target: HTMLElement) {
    const row = chips.current;
    if (!row) return;
    if (menu && anchor.current === target) {
      anchor.current = null;
      setMenu(false);
      return;
    }
    const chipBox = target.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    anchor.current = target;
    setMenuTop(chipBox.bottom - rowBox.top + 4);
    setMenu(true);
  }
  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && root.current?.contains(event.target)) return;
      setMenu(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);
  if (!present) {
    return (
      <button
        type="button"
        onClick={() => {
          setHandle("username");
          setRoles(["Photography", "Styling"]);
          setPresent(true);
        }}
        className={`flex h-[60px] w-[284px] items-center justify-center rounded-lg border border-dashed border-black text-[14px] leading-4 text-black fine-hover:hover:border-solid fine-hover:hover:bg-black fine-hover:hover:text-white ${CHIP_HOVER}`}
      >
        Добавить участника
      </button>
    );
  }
  return (
    <div ref={root} className={`relative w-[284px] ${menu ? "z-20" : ""}`}>
      <div className="flex flex-col gap-1.5 rounded-lg bg-black p-2 text-white">
        <span className="flex items-center gap-2">
          <span
            aria-label="Имя"
            data-placeholder="Имя или ник"
            role="textbox"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            onInput={(event) => {
              const field = event.currentTarget;
              if (!field.textContent) field.replaceChildren();
            }}
            onBlur={(event) => setHandle(event.currentTarget.textContent ?? "")}
            className="min-w-0 flex-1 cursor-text text-[14px] font-normal leading-4 outline-none empty:before:text-white/50 empty:before:content-[attr(data-placeholder)]"
          >
            {handle}
          </span>
          <button type="button" aria-label="Удалить" onClick={() => setPresent(false)} className="flex size-4 shrink-0 items-center justify-center">
            <PanelIcon name="x" className="size-4" strokeWidth={1.75} />
          </button>
        </span>
        <span ref={chips} className="relative flex flex-wrap items-center gap-1">
          {roles.map((role) => (
            <span key={role} className={`flex h-6 items-center gap-1 rounded border border-white px-1.5 text-[14px] leading-4 text-white fine-hover:hover:bg-white fine-hover:hover:text-black ${CHIP_HOVER}`}>
              <button type="button" onClick={(event) => openMenu(event.currentTarget.parentElement ?? event.currentTarget)} className="min-w-0">
                {role}
              </button>
              <button
                type="button"
                aria-label={`Убрать ${role}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setRoles((current) => current.filter((item) => item !== role));
                }}
                className="flex size-4 shrink-0 items-center justify-center"
              >
                <PanelIcon name="x" className="size-4" strokeWidth={1.75} />
              </button>
            </span>
          ))}
          <button type="button" onClick={(event) => openMenu(event.currentTarget)} className={`flex h-6 items-center gap-1 rounded border border-dashed border-white px-1.5 text-[14px] leading-4 text-white fine-hover:hover:border-solid fine-hover:hover:bg-white fine-hover:hover:text-black ${CHIP_HOVER}`}>
            <span aria-hidden>+</span>
            Роль
          </button>
          {menu ? (
            <div className="absolute left-0 z-30 w-60 overflow-hidden rounded-lg border border-white" style={{ top: menuTop }}>
          <Menu
            options={catalog}
            value=""
            selected={roles}
            onChange={(role) =>
              setRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]))
            }
            onCreate={(label) => {
              setCatalog((current) => (current.includes(label) ? current : [...current, label]));
              setRoles((current) => (current.includes(label) ? current : [...current, label]));
            }}
            onRemove={(role) => {
              setCatalog((current) => current.filter((item) => item !== role));
              setRoles((current) => current.filter((item) => item !== role));
            }}
          />
        </div>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function Chip({
  pressed = false,
  children,
  onClick,
  disabled,
}: {
  pressed?: boolean;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const className = chipClass(pressed);
  if (!onClick) return <span className={className}>{children}</span>;
  return (
    <button type="button" aria-pressed={pressed} disabled={disabled} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function ChoiceChips({ value, options, onChange }: { value: string; options: string[]; onChange: (next: string) => void }) {
  return (
    <span className="flex items-center gap-1">
      {options.map((option) => (
        <Chip key={option} pressed={option === value} onClick={() => onChange(option)}>
          {option}
        </Chip>
      ))}
    </span>
  );
}

function DockDivider() {
  return <span className="h-4 w-0.5 shrink-0 rounded-full bg-black/50" />;
}

function SceneDock({ state, done = false }: { state: "closed" | "open" | "search"; done?: boolean }) {
  const open = state !== "closed";
  const search = state === "search";
  return (
    <div className="flex h-9 w-fit items-center gap-1 rounded-lg bg-white p-1 text-black">
      <DockButton name="log-out" label="Выход" />
      <DockDivider />
      <DockButton name="settings" label="Настройки" />
      <DockDivider />
      <span className={`flex h-7 items-center rounded ${open ? "inset-ring inset-ring-black" : ""}`}>
        <button type="button" aria-label="Панель" aria-pressed={open} className={`flex size-7 items-center justify-center rounded ${open ? "bg-black text-white" : "text-black"}`}>
          <PanelIcon name="sliders-horizontal" className="size-5" />
        </button>
        {open ? (
          <>
            <button type="button" aria-label="Сброс" disabled={!done} className={`flex size-7 items-center justify-center rounded ${done ? "text-black" : "text-black/50"}`}>
              <PanelIcon name="trash-2" className="size-5" />
            </button>
            <button type="button" aria-label="Копировать" disabled={!done} className={`flex size-7 items-center justify-center rounded ${done ? "text-black" : "text-black/50"}`}>
              <PanelIcon name={done ? "check" : "file"} className="size-5" />
            </button>
            <button type="button" aria-label="Ссылка" className="flex size-7 items-center justify-center rounded">
              <PanelIcon name={done ? "check" : "link"} className="size-5" />
            </button>
            <button type="button" aria-label={search ? "Закрыть поиск" : "Поиск"} aria-pressed={search} className={`flex size-7 items-center justify-center rounded ${search ? "bg-black text-white" : ""}`}>
              <PanelIcon name="search" className="size-5" />
            </button>
            {search ? (
              <input
                type="search"
                placeholder="Поиск"
                aria-label="Поиск"
                className="h-7 w-36 bg-transparent pr-2 pl-1 text-[14px] leading-[18px] text-black outline-none placeholder:text-black/50"
              />
            ) : null}
          </>
        ) : null}
      </span>
      <DockButton name="spline" label="Кривая" />
      <DockButton name="waypoints" label="Ось" />
      <DockButton name="palette" label="Палитра" badge={2} />
    </div>
  );
}

function ProjectList() {
  const [rows, setRows] = useState(PROJECTS);
  const orderRef = useRef(rows.map((item) => item.title));
  orderRef.current = rows.map((item) => item.title);
  const listRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const liftPlaceRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const sourceRef = useRef<HTMLElement | null>(null);
  const flipFrom = useRef<Map<string, number> | null>(null);
  const [lift, setLift] = useState<{ html: string; width: number; height: number } | null>(null);

  function placeLift(x: number, y: number) {
    const place = liftPlaceRef.current;
    const node = liftRef.current;
    if (!place || !node) return;
    place.x = x;
    place.y = y;
    node.style.left = `${x - place.offsetX}px`;
    node.style.top = `${y - place.offsetY}px`;
  }

  useLayoutEffect(() => {
    const place = liftPlaceRef.current;
    if (!lift || !place) return;
    placeLift(place.x, place.y);
  }, [lift]);

  useLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    const root = listRef.current;
    if (!from || !root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const nodes: HTMLElement[] = [];
    for (const node of root.querySelectorAll<HTMLElement>("[data-sort-id]")) {
      if (node.hasAttribute("data-tl-lift")) continue;
      const prev = from.get(node.dataset.sortId ?? "");
      if (prev == null) continue;
      const dy = prev - node.getBoundingClientRect().top;
      if (Math.abs(dy) < 0.5) continue;
      node.style.transition = "none";
      node.style.transform = `translateY(${dy}px)`;
      nodes.push(node);
    }
    if (nodes.length === 0) return;
    root.getBoundingClientRect();
    for (const node of nodes) {
      node.style.transition = `transform ${SECTION_MS}ms ${EASE_OUT}`;
      node.style.transform = "";
    }
    const clear = window.setTimeout(() => {
      for (const node of nodes) node.style.transition = "";
    }, SECTION_MS);
    return () => window.clearTimeout(clear);
  }, [rows]);

  function shiftOrder(next: string[]) {
    const root = listRef.current;
    const from = new Map<string, number>();
    if (root) {
      for (const node of root.querySelectorAll<HTMLElement>("[data-sort-id]")) {
        from.set(node.dataset.sortId ?? "", node.getBoundingClientRect().top);
      }
    }
    flipFrom.current = from;
    setRows((list) => {
      const byTitle = new Map(list.map((item) => [item.title, item]));
      return next.flatMap((title) => {
        const item = byTitle.get(title);
        return item ? [item] : [];
      });
    });
  }

  function onPointerDown(id: string, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    bindPointerDrag(pointerId, {
      onMove(ev) {
        if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DOCK_DRAG_PX) return;
        const root = listRef.current;
        const item = root?.querySelector<HTMLElement>(`[data-sort-id="${CSS.escape(id)}"]`);
        if (!root || !item) return;
        if (!moved) {
          moved = true;
          document.documentElement.dataset.phaseDrag = "grab";
          const rect = item.getBoundingClientRect();
          liftPlaceRef.current = {
            x: ev.clientX,
            y: ev.clientY,
            offsetX: ev.clientX - rect.left,
            offsetY: ev.clientY - rect.top,
          };
          sourceRef.current = item;
          item.dataset.tlLift = "";
          setLift({ html: item.innerHTML, width: rect.width, height: rect.height });
        } else {
          placeLift(ev.clientX, ev.clientY);
        }
        const origin = root.getBoundingClientRect().top;
        const boxes = [...root.children]
          .filter((node): node is HTMLElement => node instanceof HTMLElement && node.hasAttribute("data-sort-id"))
          .map((node) => ({
            id: node.dataset.sortId ?? "",
            top: origin + node.offsetTop,
            bottom: origin + node.offsetTop + node.offsetHeight,
          }));
        const hit = panelRowSlot(boxes, id, ev.clientY);
        const current = orderRef.current.filter((itemId) => boxes.some((box) => box.id === itemId));
        const next = hit ? movePanelRow(current, id, hit.index) : current;
        if (hit && !samePanelRowOrder(current, next)) shiftOrder(next);
      },
      onEnd() {
        delete document.documentElement.dataset.phaseDrag;
        if (sourceRef.current) delete sourceRef.current.dataset.tlLift;
        sourceRef.current = null;
        liftPlaceRef.current = null;
        setLift(null);
      },
    });
  }

  return (
    <>
      <div ref={listRef} className="relative flex w-[284px] flex-col rounded-lg bg-black">
        {rows.map((item, index) => (
          <div key={item.title} data-sort-id={item.title}>
            <ProjectRow
              {...item}
              edge={index === 0 ? "first" : index === rows.length - 1 ? "last" : undefined}
              onPointerDown={(event) => onPointerDown(item.title, event)}
            />
          </div>
        ))}
      </div>
      {lift
        ? createPortal(
            <div
              ref={liftRef}
              className="pointer-events-none fixed z-[110] origin-top-left scale-[1.03]"
              style={{ width: lift.width, height: lift.height }}
            >
              <div
                className="size-full overflow-hidden bg-black shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
                style={{ borderRadius: 8 }}
                dangerouslySetInnerHTML={{ __html: lift.html }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function Name({ label, changed = false, onReset }: { label: string; changed?: boolean; onReset?: () => void }) {
  return <ChangedName changed={changed} label={label} onReset={onReset ?? (() => {})} />;
}

function ParametersSpecimen() {
  const sections = ["scene", "card"];
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set(["card"]));
  const canCollapse = sections.some((id) => !closed.has(id));
  return (
    <ParametersPanel
      title="Параметры"
      canCollapse={canCollapse}
      collapseLabel="Свернуть все"
      expandLabel="Развернуть все"
      onToggleFold={() => setClosed(canCollapse ? new Set(sections) : new Set())}
      className="w-[296px]"
    >
      <SectionFoldContext.Provider
        value={{
          closed,
          toggle: (id) =>
            setClosed((current) => {
              const next = new Set(current);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            }),
        }}
      >
        <div className="flex flex-col gap-2">
          <Section foldId="scene" title="Сцена" action={<PanelIcon name="eye-off" className="size-5" />}>
            <Row>
              <Name label="Фон" />
              <span className="flex items-center gap-2">
                <ValueField value="101014" unit="HEX" onCommit={() => {}} />
                <ValueField value="55" unit="%" current={55} min={0} max={100} onCommit={() => {}} />
                <span aria-hidden className="size-6 rounded bg-[#101014]" />
              </span>
            </Row>
          </Section>
          <Section foldId="card" title="Карточка">
            <Row>
              <Name label="Сторона" />
              <ValueField value="220" unit="px" current={220} min={80} max={480} onCommit={() => {}} />
            </Row>
          </Section>
        </div>
      </SectionFoldContext.Provider>
    </ParametersPanel>
  );
}

export function KitPage() {
  const [side, setSide] = useState(220);
  const [size, setSize] = useState(28);
  const [columns, setColumns] = useState(4);
  const [lead, setLead] = useState(0);
  const [curveOn, setCurveOn] = useState(false);
  const [shadow, setShadow] = useState(false);
  const [hex, setHex] = useState("F2F2F2");
  const [opacity, setOpacity] = useState(100);
  const [scrub, setScrub] = useState(220);
  const [padX, setPadX] = useState(24);
  const [padY, setPadY] = useState(24);
  const [range, setRange] = useState<[number, number]>([400, 700]);
  const [segment, setSegment] = useState("axis");
  const [orient, setOrient] = useState("square");
  const [fit, setFit] = useState("left");
  const [align, setAlign] = useState("left");
  const [join, setJoin] = useState("miter");
  const [order, setOrder] = useState("start");
  const [anchor, setAnchor] = useState<Anchor>("center");
  const [gaps, setGaps] = useState("8, 12");
  const [menu, setMenu] = useState("Мягкая");
  const [skips, setSkips] = useState<boolean[]>([false, true, false, false, false, false, false, false]);
  const [coords, setCoords] = useState<[number, number, number, number]>([0.22, 1, 0.36, 1]);
  const [quad, setQuad] = useState([0.22, 1, 0.36, 1]);
  const [tri, setTri] = useState([1, 0.5, 0]);
  const [spring, setSpring] = useState({ stiffness: 170, damping: 26, mass: 1 });
  const [points, setPoints] = useState([
    { x: 0, y: 0.2 },
    { x: 0.35, y: 0.75 },
    { x: 0.7, y: 0.35 },
    { x: 1, y: 0.85 },
  ]);
  const [handles, setHandles] = useState<AxisHandle[]>([null, null, null, null]);
  const [axisAt, setAxisAt] = useState(1);
  const [axisStyle, setAxisStyle] = useState<"corner" | "smooth">("smooth");
  const [motion, setMotion] = useState<"easing" | "physics">("easing");
  const [physics, setPhysics] = useState<"easing" | "physics">("physics");
  const [color, setColor] = useState<Hsva>({ h: 28, s: 0.45, v: 0.95, a: 1 });
  const [format, setFormat] = useState<ColorFormat>("hex");
  const [target, setTarget] = useState("Карточка");
  const [dates, setDates] = useState("Day");
  const [theme, setTheme] = useState<"sun" | "moon">("sun");

  useEffect(() => {
    const palette = document.documentElement;
    const dark = theme === "moon";
    palette.style.setProperty("--color-black", dark ? "#E4E4E4" : "#0B0B0B");
    palette.style.setProperty("--color-white", dark ? "#0B0B0B" : "#E4E4E4");
    return () => {
      palette.style.removeProperty("--color-black");
      palette.style.removeProperty("--color-white");
    };
  }, [theme]);

  return (
    <main data-new-ui="" className="h-dvh overflow-y-auto bg-[#767676] px-8 pt-24 pb-8 text-[#E4E4E4] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ fontFamily: FONT }}>
      <PageBar trailing={<IconPick value={theme} onChange={setTheme} options={[{ id: "sun", icon: "sun" }, { id: "moon", icon: "moon" }]} />} />
      <div className={`flex flex-col gap-10 ${theme === "moon" ? "photo-theme-dark" : ""}`}>
      <Layer name="Атомы">
      <Band name="Ряд">
        <Card name="Секция">
          <Plate>
            <Section
              title="Карточка"
              action={<PanelIcon name="eye" className="size-5" />}
            >
              <Row>
                <Name label="Сторона" changed={side !== 220} onReset={() => setSide(220)} />
                <ValueField
                  value={String(side)}
                  current={side}
                  min={80}
                  max={480}
                  unit="px"
                  onCommit={(next) => {
                    const parsed = Number(next);
                    if (Number.isFinite(parsed)) setSide(parsed);
                  }}
                />
              </Row>
            </Section>
          </Plate>
        </Card>

        <Card name="Ряд">
          <Plate>
            <Row>
              <Name label="Сторона" changed={side !== 220} onReset={() => setSide(220)} />
              <ValueField
                value={String(side)}
                current={side}
                min={80}
                max={480}
                unit="px"
                onCommit={(next) => {
                  const parsed = Number(next);
                  if (Number.isFinite(parsed)) setSide(parsed);
                }}
              />
            </Row>
          </Plate>
        </Card>
      </Band>

      <Band name="Ввод">
        <Card name="Число">
          <Plate>
            <Row>
              <Name label="Кегль" changed={size !== 28} onReset={() => setSize(28)} />
              <ValueField
                value={String(size)}
                current={size}
                min={10}
                max={96}
                unit="px"
                onCommit={(next) => {
                  const parsed = Number(next);
                  if (Number.isFinite(parsed)) setSize(parsed);
                }}
              />
            </Row>
          </Plate>
        </Card>

        <Card name="Пара">
          <Plate>
            <Row>
              <Name label="Отступы" />
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="text-white">
                    <PairGlyph icon="padX" />
                  </span>
                  <ValueField
                    value={String(padX)}
                    current={padX}
                    min={0}
                    max={120}
                    unit="px"
                    onCommit={(next) => {
                      const parsed = Number(next);
                      if (Number.isFinite(parsed)) setPadX(parsed);
                    }}
                  />
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-white">
                    <PairGlyph icon="padY" />
                  </span>
                  <ValueField
                    value={String(padY)}
                    current={padY}
                    min={0}
                    max={120}
                    unit="px"
                    onCommit={(next) => {
                      const parsed = Number(next);
                      if (Number.isFinite(parsed)) setPadY(parsed);
                    }}
                  />
                </span>
              </span>
            </Row>
          </Plate>
        </Card>

        <Card name="Скраб">
          <Plate>
            <Row className="h-auto flex-col items-stretch gap-1 p-1">
              <span className="flex h-6 items-center justify-between">
                <Name label="Сторона" />
                <ValueField
                  value={String(scrub)}
                  unit="px"
                  current={scrub}
                  min={80}
                  max={480}
                  onCommit={(next) => {
                    const parsed = Number(next);
                    if (Number.isFinite(parsed)) setScrub(Math.min(480, Math.max(80, parsed)));
                  }}
                />
              </span>
              <Track min={80} max={480} start={scrub} home={220} handle="square" onChange={setScrub} />
            </Row>
          </Plate>
        </Card>

        <Card name="Диапазон">
          <Plate>
            <Row className="h-auto flex-col items-stretch gap-1 p-1">
              <span className="flex h-6 w-full items-center justify-between">
                <Name label="Толщина" />
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="text-[14px] leading-[18px] text-white/50">от</span>
                    <ValueField
                      value={String(range[0])}
                      current={range[0]}
                      min={100}
                      max={range[1]}
                      step={10}
                      onCommit={(next) => {
                        const parsed = Number(next);
                        if (Number.isFinite(parsed)) setRange([parsed, range[1]]);
                      }}
                    />
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-[14px] leading-[18px] text-white/50">до</span>
                    <ValueField
                      value={String(range[1])}
                      current={range[1]}
                      min={range[0]}
                      max={900}
                      step={10}
                      onCommit={(next) => {
                        const parsed = Number(next);
                        if (Number.isFinite(parsed)) setRange([range[0], parsed]);
                      }}
                    />
                  </span>
                </span>
              </span>
              <Track
                min={100}
                max={900}
                step={10}
                dual
                start={range[0]}
                end={range[1]}
                home={400}
                homeEnd={700}
                onChange={(start, end) => setRange([start, end])}
              />
            </Row>
          </Plate>
        </Card>

        <Card name="Степпер">
          <Plate>
            <Row>
              <Name label="Колонки" changed={columns !== 4} onReset={() => setColumns(4)} />
              <span className="flex h-6 w-24 items-center justify-between rounded text-white inset-ring inset-ring-white">
                <button type="button" aria-label="Меньше" onClick={() => setColumns((value) => Math.max(1, value - 1))} className="flex size-6 items-center justify-center rounded bg-white text-black">
                  <StepMark kind="minus" />
                </button>
                <span>{columns}</span>
                <button type="button" aria-label="Больше" onClick={() => setColumns((value) => Math.min(6, value + 1))} className="flex size-6 items-center justify-center rounded bg-white text-black">
                  <StepMark kind="plus" />
                </button>
              </span>
            </Row>
          </Plate>
        </Card>

        <Card name="Поле">
          <Plate>
            <span className="grid h-8 grid-cols-4 gap-1 rounded-lg bg-black p-1">
              {quad.map((value, index) => (
                <CoordChip
                  key={index}
                  value={value}
                  onCommit={(next) => setQuad((current) => current.map((item, at) => (at === index ? next : item)))}
                />
              ))}
            </span>
            <span className="grid h-8 grid-cols-3 gap-1 rounded-lg bg-black p-1">
              {tri.map((value, index) => (
                <CoordChip
                  key={index}
                  value={value}
                  onCommit={(next) => setTri((current) => current.map((item, at) => (at === index ? next : item)))}
                />
              ))}
            </span>
          </Plate>
        </Card>
      </Band>

      <Band name="Кнопка">
        <Card name="Кнопка">
          <Plate>
            <Row>
              <Name label="Задержка" changed={lead !== 0} onReset={() => setLead(0)} />
              <span className="flex items-center gap-1">
                <ValueField
                  value={String(lead)}
                  current={lead}
                  min={0}
                  max={400}
                  step={10}
                  unit="ms"
                  onCommit={(next) => {
                    const parsed = Number(next);
                    if (Number.isFinite(parsed)) setLead(parsed);
                  }}
                />
                <button
                  type="button"
                  aria-label="Кривая"
                  aria-pressed={curveOn}
                  onClick={() => setCurveOn((value) => !value)}
                  className={`flex size-6 items-center justify-center rounded transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${curveOn ? "bg-white text-black" : "text-white fine-hover:hover:inset-ring fine-hover:hover:inset-ring-white"}`}
                >
                  <PanelIcon name="spline" className="size-5" />
                </button>
              </span>
            </Row>
          </Plate>
        </Card>

        <Card name="Переключатель">
          <Plate>
            <Row>
              <Name label="Тень" changed={shadow} onReset={() => setShadow(false)} />
              <button
                type="button"
                aria-pressed={shadow}
                onClick={() => setShadow((value) => !value)}
                className={`relative h-6 w-12 rounded inset-ring inset-ring-white transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${shadow ? "bg-white" : "bg-transparent"}`}
              >
                <span className={`absolute top-0 left-0 size-6 rounded bg-black inset-ring inset-ring-white transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${shadow ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </Row>
          </Plate>
        </Card>

        <Card name="Кнопки">
          <Plate hug>
            <span className="flex w-[284px] items-center gap-1">
              <AdminButton label="Сбросить">
                <PanelIcon name="trash-2" className="size-5" />
              </AdminButton>
              <AdminButton label="Сохранить">
                <PanelIcon name="save" className="size-5" />
              </AdminButton>
              <AdminButton fill>Опубликовать</AdminButton>
            </span>
          </Plate>
        </Card>
      </Band>

      <Band name="Выбор">
        <Card name="Сегмент">
          <Plate>
            <Row>
              <Name label="Ширина" />
              <Segment
                value={segment}
                onChange={setSegment}
                options={[
                  { id: "axis", label: "Ось" },
                  { id: "fill", label: "Во всю" },
                ]}
              />
            </Row>
          </Plate>
        </Card>

        <Card name="Ориентация">
          <Plate>
            <Row>
              <Name label="Ориентация" />
              <IconPick
                value={orient}
                onChange={setOrient}
                options={[
                  { id: "square", icon: "square" },
                  { id: "portrait", icon: "rectangle-vertical" },
                  { id: "landscape", icon: "rectangle-horizontal" },
                ]}
              />
            </Row>
          </Plate>
        </Card>

        <Card name="Фит">
          <Plate>
            <Row>
              <Name label="Фит" />
              <IconPick
                value={fit}
                onChange={setFit}
                options={[
                  { id: "left", icon: "align-start-vertical" },
                  { id: "center", icon: "align-center-vertical" },
                  { id: "right", icon: "align-end-vertical" },
                ]}
              />
            </Row>
          </Plate>
        </Card>

        <Card name="Выравнивание">
          <Plate>
            <Row>
              <Name label="Выравнивание" />
              <IconPick
                value={align}
                onChange={setAlign}
                options={[
                  { id: "left", icon: "align-left" },
                  { id: "center", icon: "align-center" },
                  { id: "right", icon: "align-right" },
                  { id: "justify", icon: "align-justify" },
                ]}
              />
            </Row>
          </Plate>
        </Card>

        <Card name="Стык">
          <Plate>
            <Row>
              <Name label="Тип стыка" />
              <Segment
                value={join}
                onChange={setJoin}
                options={(["miter", "round", "bevel"] as const).map((id) => ({
                  id,
                  label: id,
                  glyph: <PickGlyph name={`join-${id}`} />,
                }))}
              />
            </Row>
          </Plate>
        </Card>

        <Card name="Порядок">
          <Plate>
            <Row>
              <Name label="Порядок" />
              <Segment
                value={order}
                onChange={setOrder}
                options={(["start", "center", "end"] as const).map((id) => ({
                  id,
                  label: id,
                  glyph: <PickGlyph name={`order-${id}`} />,
                }))}
              />
            </Row>
          </Plate>
        </Card>

        <Card name="Якорь">
          <Plate>
            <Row className="h-auto flex-col items-stretch gap-1 p-1">
              <span className="flex h-6 w-full items-center">
                <Name label="Якорь" />
              </span>
              <AnchorPick value={anchor} onChange={setAnchor} />
            </Row>
          </Plate>
        </Card>

        <Card name="Меню">
          <Plate>
            <Row>
              <Name label="Кромка" />
              <span className="flex items-center gap-1 text-white">
                {menu}
                <PanelIcon name="chevrons-up-down" className="size-5" />
              </span>
            </Row>
            <div className="overflow-hidden rounded-lg border border-white">
              <Menu options={["Мягкая", "Круглая", "Острая"]} value={menu} onChange={setMenu} />
            </div>
          </Plate>
        </Card>
      </Band>

      <Band name="Набор">
        <Card name="Чипы">
          <Plate>
            <Row>
              <Name label="Dates" />
              <ChoiceChips value={dates} options={["Day", "Week", "Month"]} onChange={setDates} />
            </Row>
          </Plate>
        </Card>

        <Card name="Зазоры">
          <Plate>
            <Row className="h-auto min-h-8 flex-wrap items-start gap-x-2 gap-y-1 px-1">
              <span className="flex h-8 items-center">
                <Name label="Зазоры" />
              </span>
              <GapChips value={gaps} onChange={setGaps} />
            </Row>
          </Plate>
        </Card>

        <Card name="Пропуски">
          <Plate>
            <Row className="h-auto min-h-8 flex-wrap items-start gap-x-2 gap-y-1 px-1">
              <span className="flex h-8 items-center">
                <Name label="Пропуски" />
              </span>
              <span className="ml-auto flex flex-col gap-1 py-1">
                {[0, 1].map((row) => (
                  <span key={row} className="flex max-w-full flex-wrap justify-end gap-1">
                    {Array.from({ length: 4 }, (_, col) => {
                      const index = row * 4 + col;
                      const off = skips[index];
                      return (
                        <button
                          key={col}
                          type="button"
                          aria-pressed={off}
                          onClick={() => setSkips((current) => current.map((item, at) => (at === index ? !item : item)))}
                          className={`size-6 rounded ${off ? "border border-dashed border-white/50 bg-transparent" : "bg-white"}`}
                        />
                      );
                    })}
                  </span>
                ))}
              </span>
            </Row>
            <Row>
              <span>Перемешать</span>
              <button
                type="button"
                aria-label="Перемешать"
                onClick={() => setSkips(Array.from({ length: 8 }, () => Math.random() < 0.35))}
                className="flex size-6 items-center justify-center rounded text-white transition-[box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:hover:inset-ring fine-hover:hover:inset-ring-white motion-reduce:transition-none"
              >
                <PanelIcon name="rotate-ccw" className="size-5" />
              </button>
            </Row>
          </Plate>
        </Card>
      </Band>

      <Band name="Цвет">
        <Card name="Цвет">
          <Plate>
            <Row>
              <Name label="Карточка" />
              <span className="flex items-center gap-2">
                <ValueField
                  value={hex}
                  unit="HEX"
                  onCommit={(next) => setHex(next.replace("#", "").toUpperCase())}
                />
                <ValueField
                  value={String(opacity)}
                  unit="%"
                  current={opacity}
                  min={0}
                  max={100}
                  onCommit={(next) => {
                    const parsed = Number(next);
                    if (Number.isFinite(parsed)) setOpacity(parsed);
                  }}
                />
                <span aria-hidden className="size-6 rounded" style={{ background: `#${hex}` }} />
              </span>
            </Row>
          </Plate>
        </Card>

        <Card name="Пикер">
          <section className="flex w-64 flex-col gap-1.5 rounded-2xl bg-white p-2 text-black">
            <header className="flex h-4 items-center gap-1 px-1">
              <PanelIcon name="palette" className="size-5" />
              <span className="text-[14px] leading-4">Палитра</span>
            </header>
            <ColorPicker
              color={color}
              onChange={setColor}
              format={format}
              onFormat={setFormat}
              target={target}
              targets={["Фон", "Карточка", "Обводка", "Текст"]}
              onTarget={setTarget}
            />
          </section>
        </Card>
      </Band>

      <Band name="Подпись">
        <Card name="В виде ряда">
          <Plate>
            <Row>
              <RowHint text="Сторона минус отступы слева и справа">
                <span className="decoration-1 underline-offset-[3px] group-hover/row:underline">Ширина</span>
              </RowHint>
              <span className="text-white/50">172 px</span>
            </Row>
          </Plate>
        </Card>

        <Card name="Хоткеи">
          <Plate>
            <Row>
              <span className="decoration-1 underline-offset-[3px] group-hover/row:underline">Скрыть бар</span>
              <span className="flex items-center gap-1 text-white">
                <KeyCap><CommandMark /></KeyCap>
                <KeyCap>\</KeyCap>
              </span>
            </Row>
          </Plate>
        </Card>

        <Card name="Вне ряда">
          <Plate hug>
            <p className="flex h-4 items-center px-1 text-[14px] leading-4 whitespace-nowrap text-black/50">
              Сторона минус отступы слева и справа
            </p>
          </Plate>
        </Card>

        <Card name="Тост">
          <Toast text="Отменено · Сторона" detail="1" />
        </Card>
      </Band>

      <Band name="Вход">
        <Card name="Пароль">
          <Plate hug>
            <PasswordField />
          </Plate>
        </Card>
        <Card name="Код">
          <Plate hug>
            <CodeField />
          </Plate>
        </Card>
      </Band>
      </Layer>

      <Layer name="Организмы">
      <Band name="Панель">
        <Card name="Параметры">
          <ParametersSpecimen />
        </Card>
      </Band>
      <Band name="Док">
        <Card name="Закрыт">
          <SceneDock state="closed" />
        </Card>
        <Card name="Открыт">
          <SceneDock state="open" />
        </Card>
        <Card name="Поиск">
          <SceneDock state="search" />
        </Card>
        <Card name="Скопировано">
          <SceneDock state="open" done />
        </Card>
      </Band>

      <Band name="Список">
        <Card name="Ряд">
          <Plate hug>
            <ProjectRow {...PROJECTS[2]} alone />
          </Plate>
        </Card>
        <Card name="Список">
          <Plate hug>
            <ProjectList />
          </Plate>
        </Card>
        <Card name="Шапка">
          <Plate hug>
            <ProjectHeader />
          </Plate>
        </Card>
        <Card name="Текст">
          <Plate hug>
            <TextSpecimen />
          </Plate>
        </Card>
      </Band>

      <Band name="Медиа">
        <Card name="Добавить медиа">
          <Plate hug>
            <span className="flex items-start gap-2">
              <AddPhoto />
              <AddPhoto progress={62} index={2} total={8} />
              <AddPhoto empty />
            </span>
          </Plate>
        </Card>
        <Card name="Фото">
          <Plate hug>
            <PhotoRow />
          </Plate>
        </Card>
      </Band>

      <Card name="Кредит">
        <Plate hug>
          <Credit />
        </Plate>
      </Card>

      <Band name="Окна">
        <div className="flex flex-col gap-2">
          <h4 className="px-1 text-[14px] leading-4 text-white/50">Кривая</h4>
          <MotionWindow type={motion} onType={setMotion} curve={coords} onCurve={setCoords} spring={spring} onSpring={setSpring} />
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="px-1 text-[14px] leading-4 text-white/50">Пружина</h4>
          <MotionWindow type={physics} onType={setPhysics} curve={coords} onCurve={setCoords} spring={spring} onSpring={setSpring} />
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="px-1 text-[14px] leading-4 text-white/50">Ось</h4>
          <AxisWindow
            points={points}
            onPoints={setPoints}
            handles={handles}
            onHandles={setHandles}
            selected={axisAt}
            onSelect={setAxisAt}
            style={axisStyle}
            onStyle={(style) => {
              setAxisStyle(style);
              setHandles(points.map(() => (style === "corner" ? [0, 0] : null)));
            }}
          />
        </div>
      </Band>
      </Layer>
      </div>
    </main>
  );
}
