import type { ReactNode } from "react";

const PAGES = [
  { href: "/kit", label: "Кит" },
  { href: "/new", label: "Плейграунд" },
];

export function PageBar({ trailing }: { trailing?: ReactNode }) {
  const path = window.location.pathname;
  return (
    <header className="fixed top-0 left-0 z-[105] px-8 py-3">
      <nav className="flex h-9 w-fit items-center gap-1 rounded-lg border border-white bg-black p-1 text-white">
        {PAGES.map((page) => {
          const current = path === page.href;
          return (
            <a
              key={page.href}
              href={page.href}
              aria-current={current ? "page" : undefined}
              className={`flex h-7 items-center rounded px-2 text-[14px] leading-4 ${current ? "bg-white text-black" : "text-white/50 fine-hover:hover:text-white"}`}
            >
              {page.label}
            </a>
          );
        })}
        {trailing ? (
          <>
            <span className="mx-1 h-4 w-px bg-white/40" />
            {trailing}
          </>
        ) : null}
      </nav>
    </header>
  );
}
