import {
  type ChangeEvent,
  type DragEvent,
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  lazy,
  Suspense,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./App.css";

const LiquidGradientBackground = lazy(() =>
  import("./LiquidGradientBackground").then((m) => ({ default: m.LiquidGradientBackground })),
);
import {
  addRecentEntry,
  formatRecentTime,
  readRecent,
  removeRecentEntry,
  writeRecent,
  type RecentEntry,
} from "./recentHistory";
import {
  applyReduceMotionToDocument,
  applyThemePreferenceToDocument,
  readDisplayName,
  readReduceMotion,
  readThemePreference,
  resolveEffectiveTheme,
  writeDisplayName,
  writeReduceMotion,
  writeThemePreference,
  type ThemePreference,
} from "./userSettings";
import { formatPersonalGreeting } from "./timeGreeting";
import { mobilePdfPageWidth, useIsMobile } from "./useMediaQuery";

type PdfSource = ArrayBuffer | Uint8Array | null;

type PdfTabId = string;

function newTabId(): PdfTabId {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

interface PdfTab {
  id: PdfTabId;
  title: string;
  pdfData: PdfSource | null;
  numPages: number;
  page: number;
  scale: number;
  loadError: string | null;
  loading: boolean;
}

function allPdfFilesFromDataTransfer(dt: DataTransfer): File[] {
  const { files } = dt;
  if (!files?.length) return [];
  return Array.from(files).filter(isPdfFile);
}

const SPLASH_DONE_KEY = "pdf-reader-splash-done-v1";

function readSplashDone(): boolean {
  try {
    return localStorage.getItem(SPLASH_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSplashDone(): void {
  try {
    localStorage.setItem(SPLASH_DONE_KEY, "1");
  } catch {
    /* private mode / quota */
  }
}

function isPdfFile(file: File) {
  const n = file.name.toLowerCase();
  return n.endsWith(".pdf") || file.type === "application/pdf" || file.type === "application/x-pdf";
}

function firstPdfFromDataTransfer(dt: DataTransfer): File | null {
  const { files } = dt;
  if (!files?.length) return null;
  return Array.from(files).find(isPdfFile) ?? null;
}

function hasFilePayload(dt: DataTransfer) {
  return dt.types?.includes("Files") ?? false;
}

function isElectron() {
  return Boolean(window.electronAPI?.openPdfDialog);
}

async function loadPdfFromPath(path: string): Promise<Uint8Array> {
  const data = await window.electronAPI!.readPdfFile(path);
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  return new Uint8Array(u8);
}

function getFileDiskPath(file: File): string | undefined {
  const fromApi = window.electronAPI?.getPathForFile?.(file);
  if (fromApi) return fromApi;
  const f = file as File & { path?: string };
  return typeof f.path === "string" && f.path.length > 0 ? f.path : undefined;
}

function IconHome() {
  return (
    <svg className="app-bottom-nav__ico" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10.5L12 3l9 7.5M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg className="app-bottom-nav__ico" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Иконка PDF для центральной кнопки нижней панели */
function IconPdfDocFab() {
  return (
    <svg className="app-bottom-nav__fab-ico" width="26" height="26" viewBox="0 0 24 28" fill="none" aria-hidden>
      <path
        d="M4 3h10l6 6v16a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 3v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 14h8M8 18h8M8 22h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconOpenFile() {
  return (
    <svg className="btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 11v6m0 0l-2.5-2.5M12 17l2.5-2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg className="btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg className="btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconZoomOut() {
  return (
    <svg className="btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l4 4M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconZoomIn() {
  return (
    <svg className="btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l4 4M8 11h6M11 8v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconXSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Логотип ReadX: лист + акцент X (градиент как у прежней иконки PDF). */
function LogoReadX({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "splash" | "default" | "mark";
}) {
  const rawId = useId().replace(/:/g, "");
  const gid = `readx-grad-${rawId}`;
  const splash = variant === "splash";
  const mark = variant === "mark";
  const from = splash ? "#9ec5ff" : "#6ea8fe";
  const to = splash ? "#d8c4ff" : "#a78bfa";
  const w = mark ? 22 : splash ? 88 : 56;
  const h = mark ? 22 : splash ? 88 : 56;
  const stroke = mark ? "rgba(248, 250, 255, 0.92)" : `url(#${gid})`;

  return (
    <svg
      className={className}
      width={w}
      height={h}
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden
    >
      {!mark && (
        <defs>
          <linearGradient id={gid} x1="8" y1="6" x2="50" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
      )}
      <path
        d="M10 8h22l10 10v30a2 2 0 01-2 2H10a2 2 0 01-2-2V10a2 2 0 012-2z"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M32 8v10h10" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 22h16M14 28h12" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      <path d="M34 34l10 10M44 34l-10 10" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Прокрутка PDF: скрытый нативный скролл + тонкий кастомный рельс у колонки документа. */
function DocScrollArea({
  children,
  onViewportWidthChange,
}: {
  children: ReactNode;
  onViewportWidthChange?: (width: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ offset: number } | null>(null);
  const [rail, setRail] = useState({ show: false, thumbTop: 0, thumbH: 40, track: 100 });

  const updateRail = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const show = scrollHeight > clientHeight + 2;
    const track = clientHeight;
    const ratio = clientHeight / Math.max(scrollHeight, 1);
    const thumbH = show ? Math.min(track, Math.max(36, track * ratio)) : 0;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const thumbTop =
      maxScroll <= 0 || !show ? 0 : (scrollTop / maxScroll) * Math.max(0, track - thumbH);
    setRail({ show, thumbTop, thumbH, track });
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sync = () => {
      el.scrollLeft = 0;
      onViewportWidthChange?.(el.clientWidth);
      updateRail();
    };
    sync();
    el.addEventListener("scroll", updateRail, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    const mo = new MutationObserver(sync);
    mo.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    return () => {
      el.removeEventListener("scroll", updateRail);
      ro.disconnect();
      mo.disconnect();
    };
  }, [updateRail, children, onViewportWidthChange]);

  const scrollToThumbTop = useCallback((thumbTop: number) => {
    const el = scrollRef.current;
    if (!el || !rail.show) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    const span = Math.max(0, rail.track - rail.thumbH);
    el.scrollTop = span <= 0 ? 0 : (thumbTop / span) * maxScroll;
  }, [rail.show, rail.track, rail.thumbH]);

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rail.show || (e.target as HTMLElement).closest(".doc-scroll-area__thumb")) return;
    const railEl = e.currentTarget;
    const rect = railEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const thumbTop = Math.max(0, Math.min(rail.track - rail.thumbH, y - rail.thumbH / 2));
    scrollToThumbTop(thumbTop);
  };

  const onThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rail.show) return;
    e.preventDefault();
    e.stopPropagation();
    const railEl = e.currentTarget.parentElement as HTMLDivElement;
    const rect = railEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    dragRef.current = { offset: y - rail.thumbTop };
    railEl.setPointerCapture(e.pointerId);
  };

  const onRailPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const railEl = e.currentTarget;
    const rect = railEl.getBoundingClientRect();
    const y = e.clientY - rect.top - d.offset;
    const thumbTop = Math.max(0, Math.min(rail.track - rail.thumbH, y));
    scrollToThumbTop(thumbTop);
  };

  const endRailPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
  };

  return (
    <div className="doc-scroll-area">
      <div className="doc-scroll-area__row">
        <div ref={scrollRef} className="doc-scroll-area__viewport">
          {children}
        </div>
        <div
          className="doc-scroll-area__rail"
          data-hidden={!rail.show ? "1" : undefined}
          onPointerDown={onTrackPointerDown}
          onPointerMove={onRailPointerMove}
          onPointerUp={endRailPointer}
          onPointerCancel={endRailPointer}
        >
          {rail.show && (
            <div
              role="presentation"
              className="doc-scroll-area__thumb"
              style={{ top: rail.thumbTop, height: rail.thumbH }}
              onPointerDown={onThumbPointerDown}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DocDock({
  className,
  tab,
  onPrev,
  onNext,
  onZoomOut,
  onZoomIn,
  onPageInput,
}: {
  className: string;
  tab: PdfTab;
  onPrev: () => void;
  onNext: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onPageInput: (page: number) => void;
}) {
  return (
    <div className={className} role="toolbar" aria-label="Навигация по документу">
      <div className="dock__group">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={onPrev}
          disabled={tab.page <= 1}
          title="Предыдущая страница"
          aria-label="Предыдущая страница"
        >
          <IconChevronLeft />
        </button>
        <label className="dock__page">
          <span className="sr-only">Номер страницы</span>
          <input
            type="number"
            min={1}
            max={tab.numPages}
            value={tab.page}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isFinite(v)) onPageInput(v);
            }}
          />
          <span className="dock__of">/ {tab.numPages}</span>
        </label>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={onNext}
          disabled={tab.page >= tab.numPages}
          title="Следующая страница"
          aria-label="Следующая страница"
        >
          <IconChevronRight />
        </button>
      </div>
      <div className="dock__divider" aria-hidden />
      <div className="dock__group">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={onZoomOut}
          title="Уменьшить"
          aria-label="Уменьшить масштаб"
        >
          <IconZoomOut />
        </button>
        <span className="dock__zoom">{Math.round(tab.scale * 100)}%</span>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={onZoomIn}
          title="Увеличить"
          aria-label="Увеличить масштаб"
        >
          <IconZoomIn />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [tabs, setTabs] = useState<PdfTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<PdfTabId | null>(null);
  const activeTabIdRef = useRef<PdfTabId | null>(null);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const activeTab = useMemo(
    () => (activeTabId ? tabs.find((t) => t.id === activeTabId) ?? null : null),
    [tabs, activeTabId],
  );

  const [dragActive, setDragActive] = useState(false);
  const [recentList, setRecentList] = useState<RecentEntry[]>(() => {
    const list = readRecent();
    return isElectron() ? list.filter((e) => Boolean(e.path)) : list;
  });
  const [recentHint, setRecentHint] = useState<string | null>(null);
  const [appStarted, setAppStarted] = useState(readSplashDone);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(() => readDisplayName());
  const [themePref, setThemePref] = useState<ThemePreference>(() => readThemePreference());
  const [reduceMotion, setReduceMotion] = useState(() => readReduceMotion());
  const [welcomeGreetingReveal, setWelcomeGreetingReveal] = useState(false);
  const [greetingRevealSeq, setGreetingRevealSeq] = useState(0);
  const isMobile = useIsMobile();
  const [docViewportWidth, setDocViewportWidth] = useState(0);
  const onDocViewportWidthChange = useCallback((w: number) => {
    setDocViewportWidth(w);
  }, []);
  const mobilePageRenderWidth = useMemo(() => {
    if (!isMobile) return 0;
    const fitBase = docViewportWidth > 0 ? Math.max(200, Math.floor(docViewportWidth - 12)) : mobilePdfPageWidth();
    const zoom = activeTab?.scale ?? 1;
    return Math.round(fitBase * zoom);
  }, [isMobile, docViewportWidth, activeTab?.scale]);
  const defaultPdfScale = useCallback(() => (isMobile ? 1 : 1.1), [isMobile]);
  const settingsNameId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const rememberOpen = useCallback((entry: Omit<RecentEntry, "openedAt">) => {
    setRecentList((prev) => {
      const base = prev.length > 0 ? prev : readRecent();
      const next = addRecentEntry(base, entry);
      writeRecent(next);
      return next;
    });
  }, []);

  const forgetRecentEntry = useCallback((entry: RecentEntry) => {
    setRecentList((prev) => {
      const next = removeRecentEntry(prev, entry);
      writeRecent(next);
      return next;
    });
  }, []);

  const [splashTransition, setSplashTransition] = useState<null | "leaving" | "greeting">(null);

  const completeSplashTransition = useCallback(() => {
    writeSplashDone();
    setAppStarted(true);
    setSplashTransition(null);
    if (displayName.trim()) {
      setGreetingRevealSeq((n) => n + 1);
      setWelcomeGreetingReveal(true);
    }
  }, [displayName]);

  const beginSplashTransition = useCallback(() => {
    if (reduceMotion) {
      completeSplashTransition();
      return;
    }
    setSplashTransition("leaving");
  }, [reduceMotion, completeSplashTransition]);

  const closeSession = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
    dragDepthRef.current = 0;
    setDragActive(false);
  }, []);

  const closeTab = useCallback((id: PdfTabId) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.id !== id);
      const cur = activeTabIdRef.current;
      if (cur === id) {
        const pick =
          next.length === 0 ? null : idx >= next.length ? next[next.length - 1]!.id : next[idx]!.id;
        setActiveTabId(pick);
      }
      return next;
    });
  }, []);

  /** Первый экран (сплэш «Начать»); история файлов сохраняется. */
  const goToSplashScreen = useCallback(() => {
    closeSession();
    setSettingsOpen(false);
    setAppStarted(false);
    setSplashTransition(null);
    setWelcomeGreetingReveal(false);
  }, [closeSession]);

  const triggerOpen = useCallback(() => {
    if (isElectron()) return;
    fileInputRef.current?.click();
  }, []);

  const openPdfAtPath = useCallback(
    async (path: string, displayName?: string): Promise<boolean> => {
      const id = newTabId();
      const base = displayName ?? path.split(/[/\\]/).pop() ?? "document.pdf";
      setTabs((prev) => [
        ...prev,
        {
          id,
          title: base,
          pdfData: null,
          numPages: 0,
          page: 1,
          scale: defaultPdfScale(),
          loadError: null,
          loading: true,
        },
      ]);
      setActiveTabId(id);
      try {
        const data = await loadPdfFromPath(path);
        rememberOpen({ path, name: base });
        setTabs((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, pdfData: new Uint8Array(data), loading: false, loadError: null } : t,
          ),
        );
        return true;
      } catch (e) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  loading: false,
                  loadError: e instanceof Error ? e.message : "Не удалось открыть файл",
                }
              : t,
          ),
        );
        return false;
      }
    },
    [rememberOpen, defaultPdfScale],
  );

  const loadPdfFile = useCallback(
    async (file: File): Promise<void> => {
      if (!isPdfFile(file)) {
        setRecentHint("Поддерживаются только PDF-файлы");
        return;
      }
      const diskPath = getFileDiskPath(file);
      if (isElectron() && diskPath) {
        await openPdfAtPath(diskPath, file.name);
        return;
      }
      const id = newTabId();
      setTabs((prev) => [
        ...prev,
        {
          id,
          title: file.name,
          pdfData: null,
          numPages: 0,
          page: 1,
          scale: defaultPdfScale(),
          loadError: null,
          loading: true,
        },
      ]);
      setActiveTabId(id);
      try {
        const buf = await file.arrayBuffer();
        const u8 = new Uint8Array(buf);
        rememberOpen({
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          ...(diskPath ? { path: diskPath } : {}),
        });
        setTabs((prev) =>
          prev.map((t) => (t.id === id ? { ...t, pdfData: u8, loading: false, loadError: null } : t)),
        );
      } catch (err) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  loading: false,
                  loadError: err instanceof Error ? err.message : "Ошибка чтения файла",
                }
              : t,
          ),
        );
      }
    },
    [rememberOpen, defaultPdfScale, openPdfAtPath],
  );

  const openViaElectron = useCallback(
    async (defaultPath?: string | null): Promise<void> => {
      const path = await window.electronAPI!.openPdfDialog(defaultPath ?? null);
      if (!path) return;
      await openPdfAtPath(path);
    },
    [openPdfAtPath],
  );

  const openRecentEntry = useCallback(
    async (entry: RecentEntry) => {
      if (isElectron()) {
        if (entry.path) {
          const ok = await openPdfAtPath(entry.path, entry.name);
          if (!ok) {
            forgetRecentEntry(entry);
            setRecentHint("Файл не найден — откройте PDF снова через Ctrl+O.");
          }
          return;
        }
        setRecentHint("Для этой записи нет пути на диске — выберите PDF через диалог (Ctrl+O).");
        return;
      }
      setRecentHint("В браузере путь к файлу недоступен — выберите PDF через Ctrl+O или кнопку ниже.");
      triggerOpen();
    },
    [forgetRecentEntry, openPdfAtPath, triggerOpen],
  );

  const onPickFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).filter(isPdfFile);
      e.target.value = "";
      if (!files.length) return;
      void (async () => {
        for (const file of files) {
          await loadPdfFile(file);
        }
      })();
    },
    [loadPdfFile],
  );

  const endDragVisual = useCallback(() => {
    dragDepthRef.current = 0;
    setDragActive(false);
  }, []);

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (!hasFilePayload(e.dataTransfer)) return;
    dragDepthRef.current += 1;
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) endDragVisual();
  }, [endDragVisual]);

  const onDragOver = useCallback((e: DragEvent) => {
    if (!hasFilePayload(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      endDragVisual();
      const pdfs = allPdfFilesFromDataTransfer(e.dataTransfer);
      if (pdfs.length) {
        void (async () => {
          for (const pdf of pdfs) {
            await loadPdfFile(pdf);
          }
        })();
        return;
      }
      if (e.dataTransfer.files?.length) setRecentHint("Поддерживаются только PDF-файлы");
    },
    [endDragVisual, loadPdfFile],
  );

  useEffect(() => {
    const onDragEnd = () => endDragVisual();
    window.addEventListener("dragend", onDragEnd);
    return () => window.removeEventListener("dragend", onDragEnd);
  }, [endDragVisual]);

  useEffect(() => {
    if (!isElectron()) return;
    const all = readRecent();
    const next = all.filter((e) => Boolean(e.path));
    if (next.length !== all.length) {
      writeRecent(next);
      setRecentList(next);
    }
  }, []);

  useEffect(() => {
    if (!recentHint) return;
    const t = window.setTimeout(() => setRecentHint(null), 5000);
    return () => window.clearTimeout(t);
  }, [recentHint]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.(".settings-panel")) return;
      if (t.closest?.(".app-bottom-nav")) return;
      if (t.closest?.(".dock")) return;
      if (t.closest?.(".tab-bar")) return;
      setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [settingsOpen]);

  useEffect(() => {
    if (!appStarted) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.isContentEditable || el.closest?.('[contenteditable="true"]')) return;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "o" || e.key === "O") && !e.altKey) {
        e.preventDefault();
        if (isElectron()) void openViaElectron();
        else triggerOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [appStarted, openViaElectron, triggerOpen]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!appStarted) return;
      if (settingsOpen) {
        e.preventDefault();
        setSettingsOpen(false);
        return;
      }
      const cur = activeTabIdRef.current;
      if (!cur) return;
      e.preventDefault();
      closeTab(cur);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [closeTab, appStarted, settingsOpen]);

  useEffect(() => {
    const n = activeTab?.numPages ?? 0;
    const id = activeTabId;
    if (!n || !id) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowLeft" || ev.key === "PageUp") {
        ev.preventDefault();
        setTabs((prev) =>
          prev.map((t) => (t.id === id ? { ...t, page: Math.max(1, t.page - 1) } : t)),
        );
      }
      if (ev.key === "ArrowRight" || ev.key === "PageDown") {
        ev.preventDefault();
        setTabs((prev) =>
          prev.map((t) => (t.id === id ? { ...t, page: Math.min(n, t.page + 1) } : t)),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab?.numPages, activeTabId]);

  const goPrev = () => {
    const id = activeTabIdRef.current;
    if (!id) return;
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, page: Math.max(1, t.page - 1) } : t)),
    );
  };
  const goNext = () => {
    const id = activeTabIdRef.current;
    if (!id) return;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const max = t.numPages || 1;
        return { ...t, page: Math.min(max, t.page + 1) };
      }),
    );
  };

  const zoomIn = () => {
    const id = activeTabIdRef.current;
    if (!id) return;
    const step = isMobile ? 0.15 : 0.1;
    const max = 2.5;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, scale: Math.min(max, Math.round((t.scale + step) * 100) / 100) } : t,
      ),
    );
  };
  const zoomOut = () => {
    const id = activeTabIdRef.current;
    if (!id) return;
    const step = isMobile ? 0.2 : 0.1;
    const min = isMobile ? 0.2 : 0.5;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, scale: Math.max(min, Math.round((t.scale - step) * 100) / 100) } : t,
      ),
    );
  };

  const handleDocPageInput = useCallback((page: number) => {
    const id = activeTabIdRef.current;
    if (!id) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, page: Math.min(t.numPages || 1, Math.max(1, page)) } : t,
      ),
    );
  }, []);

  const documentOptions = useMemo(() => {
    if (isElectron()) return { verbosity: 0 };
    return {
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    };
  }, []);

  const documentFile = useMemo(() => {
    if (!activeTab?.pdfData) return null;
    const bytes =
      activeTab.pdfData instanceof Uint8Array ? activeTab.pdfData : new Uint8Array(activeTab.pdfData);
    return { data: new Uint8Array(bytes) };
  }, [activeTab?.pdfData]);

  const handlePrimaryOpen = () => {
    if (isElectron()) void openViaElectron();
    else triggerOpen();
  };

  const onSplashDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      endDragVisual();
      const pdf = firstPdfFromDataTransfer(e.dataTransfer);
      if (pdf) {
        completeSplashTransition();
        void loadPdfFile(pdf);
        return;
      }
      if (e.dataTransfer.files?.length) {
        completeSplashTransition();
        setRecentHint("Поддерживаются только PDF-файлы");
      }
    },
    [endDragVisual, completeSplashTransition, loadPdfFile],
  );

  useEffect(() => {
    if (tabs.length > 0 && !activeTabId) {
      setActiveTabId(tabs[0]!.id);
    }
    if (tabs.length === 0 && activeTabId !== null) {
      setActiveTabId(null);
    }
  }, [tabs, activeTabId]);

  const docReading = appStarted && Boolean(activeTab?.pdfData && !activeTab.loadError);
  const showTopbar = tabs.length > 0;
  const anyTabLoading = tabs.some((t) => t.loading);

  const [readingBackdropMounted, setReadingBackdropMounted] = useState(false);
  const [readingBackdropVisible, setReadingBackdropVisible] = useState(false);
  const [bottomNavMotion, setBottomNavMotion] = useState<"idle" | "reveal" | "dismiss">("idle");
  const prevDocReadingRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (docReading) {
      setReadingBackdropMounted(true);
      if (reduceMotion) {
        setReadingBackdropVisible(true);
        return;
      }
      setReadingBackdropVisible(false);
      const id = window.setTimeout(() => setReadingBackdropVisible(true), 48);
      return () => clearTimeout(id);
    }
    if (reduceMotion) {
      setReadingBackdropVisible(false);
      setReadingBackdropMounted(false);
      return;
    }
    setReadingBackdropVisible(false);
    const id = window.setTimeout(() => setReadingBackdropMounted(false), 480);
    return () => clearTimeout(id);
  }, [docReading, reduceMotion]);

  useEffect(() => {
    if (!appStarted) {
      prevDocReadingRef.current = null;
      return;
    }
    const prev = prevDocReadingRef.current;
    if (prev === null) {
      prevDocReadingRef.current = docReading;
      return;
    }
    if (prev === docReading) return;
    prevDocReadingRef.current = docReading;

    if (reduceMotion) {
      setBottomNavMotion("idle");
      return;
    }

    if (docReading) {
      setBottomNavMotion("dismiss");
      const t = window.setTimeout(() => setBottomNavMotion("idle"), 420);
      return () => clearTimeout(t);
    }
    setBottomNavMotion("reveal");
    const t = window.setTimeout(() => setBottomNavMotion("idle"), 680);
    return () => clearTimeout(t);
  }, [appStarted, docReading, reduceMotion]);

  useLayoutEffect(() => {
    applyThemePreferenceToDocument(themePref);
    applyReduceMotionToDocument(reduceMotion);
  }, [themePref, reduceMotion]);

  useEffect(() => {
    if (themePref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => applyThemePreferenceToDocument("system");
    mq.addEventListener("change", onScheme);
    return () => mq.removeEventListener("change", onScheme);
  }, [themePref]);

  useEffect(() => {
    writeThemePreference(themePref);
  }, [themePref]);

  useEffect(() => {
    writeReduceMotion(reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    if (!welcomeGreetingReveal || reduceMotion) return;
    const t = window.setTimeout(() => setWelcomeGreetingReveal(false), 1100);
    return () => clearTimeout(t);
  }, [welcomeGreetingReveal, reduceMotion]);

  useEffect(() => {
    if (splashTransition !== "leaving") return;
    const t = window.setTimeout(() => {
      if (displayName.trim()) {
        setGreetingRevealSeq((n) => n + 1);
        setSplashTransition("greeting");
      } else {
        completeSplashTransition();
      }
    }, 480);
    return () => clearTimeout(t);
  }, [splashTransition, displayName, completeSplashTransition]);

  useEffect(() => {
    if (splashTransition !== "greeting") return;
    const t = window.setTimeout(() => completeSplashTransition(), 1050);
    return () => clearTimeout(t);
  }, [splashTransition, completeSplashTransition]);

  const commitDisplayName = useCallback(() => {
    const t = displayName.trim();
    setDisplayName(t);
    writeDisplayName(t);
  }, [displayName]);

  return (
    <Fragment>
      {!reduceMotion && (
        <Suspense fallback={null}>
          <LiquidGradientBackground paused={docReading} />
        </Suspense>
      )}
      <div className="app-shell">
      {!appStarted && (
        <div
          className={`splash${dragActive ? " splash--drag" : ""}${
            splashTransition === "greeting" ? " splash--greeting" : ""
          }`}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onSplashDrop}
        >
          {dragActive && splashTransition === null && (
            <div className="drop-overlay" aria-hidden>
              <div className="drop-overlay__box">
                <span className="drop-overlay__title">Отпустите файл</span>
                <span className="drop-overlay__hint">Откроется после загрузки</span>
              </div>
            </div>
          )}
          <div
            className={`splash__glow${splashTransition ? " splash__glow--fade" : ""}`}
            aria-hidden
          />
          {splashTransition !== "greeting" && (
            <div className="splash__inner">
              <div
                className={`splash__glass${
                  splashTransition === "leaving" ? " splash__glass--exit" : ""
                }`}
              >
                <LogoReadX className="splash__logo splash__exit-item" variant="splash" />
                <h1 className="splash__title splash__exit-item" id="splash-title">
                  Добро пожаловать
                </h1>
                <p className="splash__subtitle splash__exit-item">ReadX — лёгкий просмотр PDF</p>
              <button
                type="button"
                className="btn btn--primary btn--splash splash__exit-item"
                onClick={beginSplashTransition}
                disabled={splashTransition !== null}
              >
                Начать
              </button>
              <p className="splash__hint splash__exit-item">Можно перетащить PDF сюда</p>
              </div>
            </div>
          )}
          {splashTransition === "greeting" && displayName.trim() && (
            <div className="splash__greeting-stage" role="status" aria-live="polite">
              <p key={greetingRevealSeq} className="splash__greeting welcome__hello--reveal">
                {formatPersonalGreeting(displayName)}
              </p>
            </div>
          )}
        </div>
      )}
      {appStarted && (
    <div
      className={`app ${docReading ? "app--doc" : "app--bottom-nav"}${isMobile ? " app--mobile" : ""}${dragActive ? " app--drag" : ""}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dragActive && (
        <div className="drop-overlay" aria-hidden>
          <div className="drop-overlay__box">
            <span className="drop-overlay__title">Отпустите файл</span>
            <span className="drop-overlay__hint">Откроется в режиме чтения</span>
          </div>
        </div>
      )}
      {readingBackdropMounted && (
        <div
          className={`doc-reading-backdrop${readingBackdropVisible ? " doc-reading-backdrop--visible" : ""}`}
          aria-hidden
        />
      )}
      {showTopbar && (
      <header className={`topbar${docReading ? " topbar--doc" : ""}${tabs.length > 0 ? " topbar--tabs" : ""}`}>
        <div className="topbar__main">
          <div className="topbar__brand">
            <button
              type="button"
              className="topbar__mark"
              onClick={() => {
                setSettingsOpen(false);
                goToSplashScreen();
              }}
              aria-label="На главный экран"
              title="На главную"
            >
              <LogoReadX variant="mark" />
            </button>
            <div className="topbar__titles">
              <span className="topbar__name">ReadX</span>
              <span className="topbar__tag">только чтение</span>
            </div>
          </div>
          {docReading && activeTab && activeTab.numPages > 0 && !isMobile && (
            <DocDock
              className="dock dock--topbar"
              tab={activeTab}
              onPrev={goPrev}
              onNext={goNext}
              onZoomOut={zoomOut}
              onZoomIn={zoomIn}
              onPageInput={handleDocPageInput}
            />
          )}
        </div>
        {tabs.length > 0 && (
          <div className="tab-bar" role="tablist" aria-label="Открытые PDF">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  className={`tab-bar__tab${isActive ? " tab-bar__tab--active" : ""}`}
                  role="tab"
                  aria-selected={isActive}
                >
                  <button
                    type="button"
                    className="tab-bar__tab-hit"
                    onClick={() => setActiveTabId(tab.id)}
                    title={tab.title}
                  >
                    <span className="tab-bar__dot" aria-hidden />
                    <span className="tab-bar__title">{tab.title}</span>
                  </button>
                  <button
                    type="button"
                    className="tab-bar__close"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    aria-label={`Закрыть «${tab.title}»`}
                    title="Закрыть"
                  >
                    <IconXSmall />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </header>
      )}
      {!isElectron() && (
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={onPickFile}
          aria-label="Выбор PDF-файлов"
        />
      )}

      {recentHint && (
        <div className="recent-toast" role="status">
          {recentHint}
        </div>
      )}

      <main className={`viewport viewport--app-nav ${activeTab?.pdfData && !activeTab.loadError ? "viewport--doc" : ""}`}>
        {tabs.length === 0 && (
          <div className="welcome" role="region" aria-label="Приветствие">
            <div className="welcome__glow" aria-hidden />
            <div className="welcome__bundle">
              <div className="welcome__card">
                <header className="welcome__header">
                  <LogoReadX className="welcome__logo" variant="default" />
                  <p className="welcome__brand">ReadX</p>
                  {displayName.trim() ? (
                    <p
                      key={greetingRevealSeq}
                      className={`welcome__hello${
                        welcomeGreetingReveal && !reduceMotion ? " welcome__hello--reveal" : ""
                      }`}
                    >
                      {formatPersonalGreeting(displayName)}
                    </p>
                  ) : null}
                </header>

                <div className="welcome__cta">
                  <button type="button" className="btn btn--primary btn--lg" onClick={handlePrimaryOpen} disabled={anyTabLoading}>
                    <IconOpenFile />
                    {anyTabLoading ? "Загрузка…" : "Открыть PDF"}
                  </button>
                </div>
              </div>

              {recentList.length > 0 && (
                <section className="recent-block" aria-label="Недавние файлы">
                  <h2 className="recent-block__title">Недавние</h2>
                  <div className="recent-block__scroll">
                    <ul className="recent-block__list">
                      {recentList.map((entry) => (
                        <li
                          key={
                            entry.path
                              ? entry.path
                              : `${entry.name}-${entry.size ?? 0}-${entry.lastModified ?? 0}-${entry.openedAt}`
                          }
                          className="recent-block__row"
                        >
                          <button
                            type="button"
                            className="recent-block__open"
                            onClick={() => void openRecentEntry(entry)}
                          >
                            <span className="recent-block__name">{entry.name}</span>
                            <span className="recent-block__time">{formatRecentTime(entry.openedAt)}</span>
                          </button>
                          <button
                            type="button"
                            className="recent-block__remove"
                            onClick={() => forgetRecentEntry(entry)}
                            aria-label={`Удалить «${entry.name}» из истории`}
                            title="Убрать из списка"
                          >
                            <IconXSmall />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {activeTab?.loadError && (
          <div className="error-panel" role="alert">
            <p className="error-panel__title">Не удалось открыть</p>
            <p className="error-panel__msg">{activeTab.loadError}</p>
            <div className="error-panel__actions">
              <button type="button" className="btn btn--ghost" onClick={closeSession}>
                Закрыть все
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  if (activeTabId) closeTab(activeTabId);
                  handlePrimaryOpen();
                }}
              >
                Другой файл
              </button>
            </div>
          </div>
        )}

        {activeTab?.loading && !activeTab.pdfData && (
          <div className="canvas-wrap canvas-wrap--busy">
            <div className="doc-loading">
              <span className="doc-loading__spinner" aria-hidden />
              <span>Открываем документ…</span>
            </div>
          </div>
        )}

        {activeTab?.pdfData && !activeTab.loadError && (
          <div key={activeTab.id} className="canvas-wrap canvas-wrap--doc">
            <DocScrollArea onViewportWidthChange={isMobile ? onDocViewportWidthChange : undefined}>
              <Document
                file={documentFile}
                onLoadSuccess={({ numPages: n }) => {
                  const tid = activeTab.id;
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === tid
                        ? {
                            ...t,
                            numPages: n,
                            page: 1,
                            loadError: null,
                            ...(isMobile ? { scale: 1 } : {}),
                          }
                        : t,
                    ),
                  );
                }}
                onLoadError={(err) => {
                  const tid = activeTab.id;
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === tid ? { ...t, loadError: err instanceof Error ? err.message : String(err) } : t,
                    ),
                  );
                }}
                loading={
                  <div className="doc-loading">
                    <span className="doc-loading__spinner" aria-hidden />
                    <span>Открываем документ…</span>
                  </div>
                }
                options={documentOptions}
              >
                <Page
                  key={`${activeTab.id}-${activeTab.page}-${isMobile ? mobilePageRenderWidth : activeTab.scale}`}
                  pageNumber={activeTab.page}
                  {...(isMobile
                    ? {
                        width: mobilePageRenderWidth,
                        style: { width: mobilePageRenderWidth, maxWidth: "none" },
                      }
                    : { scale: activeTab.scale })}
                  className="pdf-page"
                  renderTextLayer={!isMobile}
                  renderAnnotationLayer
                />
              </Document>
            </DocScrollArea>
          </div>
        )}



      </main>
      {docReading && activeTab && activeTab.numPages > 0 && isMobile && (
        <DocDock
          className="dock dock--doc"
          tab={activeTab}
          onPrev={goPrev}
          onNext={goNext}
          onZoomOut={zoomOut}
          onZoomIn={zoomIn}
          onPageInput={handleDocPageInput}
        />
      )}


      <nav
        className={`app-bottom-nav${docReading ? " app-bottom-nav--concealed" : ""}${
          bottomNavMotion === "reveal" ? " app-bottom-nav--motion-reveal" : ""
        }${bottomNavMotion === "dismiss" ? " app-bottom-nav--motion-dismiss" : ""}`}
        aria-label="Основные действия"
        aria-hidden={docReading}
      >
        <div className="app-bottom-nav__inner">
          <div className="app-bottom-nav__rail">
            <button
              type="button"
              className="app-bottom-nav__side"
              onClick={() => {
                setSettingsOpen(false);
                goToSplashScreen();
              }}
              aria-label="На первый экран"
              title="Первый экран"
            >
              <IconHome />
              <span className="app-bottom-nav__label">Главная</span>
            </button>
            <button
              type="button"
              className="app-bottom-nav__fab"
              onClick={() => {
                setSettingsOpen(false);
                handlePrimaryOpen();
              }}
              disabled={anyTabLoading}
              aria-label="Открыть PDF"
              title="Открыть PDF"
            >
              <IconPdfDocFab />
            </button>
            <button
              type="button"
              className="app-bottom-nav__side"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-expanded={settingsOpen}
              aria-label="Настройки"
              title="Настройки"
            >
              <IconSettings />
              <span className="app-bottom-nav__label">Настройки</span>
            </button>
          </div>
        </div>
      </nav>

      {settingsOpen && (
        <div
          className="settings-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-heading"
        >
          <div className="settings-panel">
            <div className="settings-panel__head">
              <h2 id="settings-heading" className="settings-panel__title">
                Настройки
              </h2>
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                onClick={() => setSettingsOpen(false)}
                aria-label="Закрыть настройки"
              >
                <IconXSmall />
              </button>
            </div>
            <p className="settings-panel__text">
              Имя и оформление сохраняются в этом браузере. Режим «без анимаций» отключает переходы и фоновую
              анимацию.
            </p>
            <div className="settings-fields">
              <div className="settings-field">
                <label className="settings-field__label" htmlFor={settingsNameId}>
                  Ваше имя
                </label>
                <input
                  id={settingsNameId}
                  className="settings-field__input"
                  type="text"
                  autoComplete="nickname"
                  placeholder="Например, Алексей"
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={commitDisplayName}
                />
              </div>

              <div className="settings-switch-row">
                <div className="settings-switch-row__text">
                  <span className="settings-switch-row__title" id="settings-system-label">
                    Системная тема
                  </span>
                  <span className="settings-switch-row__hint" id="settings-system-desc">
                    Подстраиваться под светлую или тёмную тему устройства
                  </span>
                </div>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    className="settings-switch__input"
                    checked={themePref === "system"}
                    onChange={(e) => {
                      if (e.target.checked) setThemePref("system");
                      else setThemePref(resolveEffectiveTheme("system"));
                    }}
                    aria-labelledby="settings-system-label"
                    aria-describedby="settings-system-desc"
                  />
                  <span className="settings-switch__track" aria-hidden>
                    <span className="settings-switch__thumb" />
                  </span>
                </label>
              </div>

              <div className="settings-switch-row">
                <div className="settings-switch-row__text">
                  <span className="settings-switch-row__title" id="settings-light-label">
                    Светлое оформление
                  </span>
                  <span className="settings-switch-row__hint" id="settings-light-desc">
                    {themePref === "system"
                      ? "Выключите «Системную тему», чтобы выбрать вручную"
                      : "Тёмная или светлая тема приложения"}
                  </span>
                </div>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    className="settings-switch__input"
                    checked={themePref === "light"}
                    disabled={themePref === "system"}
                    onChange={(e) => setThemePref(e.target.checked ? "light" : "dark")}
                    aria-labelledby="settings-light-label"
                    aria-describedby="settings-light-desc"
                  />
                  <span className="settings-switch__track" aria-hidden>
                    <span className="settings-switch__thumb" />
                  </span>
                </label>
              </div>

              <div className="settings-switch-row">
                <div className="settings-switch-row__text">
                  <span className="settings-switch-row__title" id="settings-motion-label">
                    Без анимаций
                  </span>
                  <span className="settings-switch-row__hint" id="settings-motion-desc">
                    Убирает переходы, анимации интерфейса и движущийся фон
                  </span>
                </div>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    className="settings-switch__input"
                    checked={reduceMotion}
                    onChange={(e) => setReduceMotion(e.target.checked)}
                    aria-labelledby="settings-motion-label"
                    aria-describedby="settings-motion-desc"
                  />
                  <span className="settings-switch__track" aria-hidden>
                    <span className="settings-switch__thumb" />
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
      )}
    </div>
    </Fragment>
  );
}
