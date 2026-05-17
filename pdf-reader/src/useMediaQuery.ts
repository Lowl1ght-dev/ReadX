import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 768px)");
}

/** Ширина PDF-страницы в px под экран телефона (учитывает боковые отступы) */
export function mobilePdfPageWidth(): number {
  if (typeof window === "undefined") return 340;
  const pad = 52;
  return Math.max(260, Math.floor(window.innerWidth - pad));
}

/** Хук: пересчёт ширины при повороте / resize */
export function useMobilePdfPageWidth(): number {
  const isMobile = useIsMobile();
  const [width, setWidth] = useState(() => mobilePdfPageWidth());

  useEffect(() => {
    if (!isMobile) return;
    const update = () => setWidth(mobilePdfPageWidth());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isMobile]);

  return isMobile ? width : 0;
}
