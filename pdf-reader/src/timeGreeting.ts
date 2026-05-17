/** Приветствие по локальному времени устройства */
export function getTimeBasedGreeting(now: Date = new Date()): string {
  const hour = now.getHours();

  if (hour >= 4 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 15) return "Здравствуйте";
  if (hour >= 15 && hour < 22) return "Добрый вечер";
  return "Доброй ночи";
}

export function formatPersonalGreeting(name: string, now?: Date): string {
  const trimmed = name.trim();
  if (!trimmed) return getTimeBasedGreeting(now);
  return `${getTimeBasedGreeting(now)}, ${trimmed}`;
}
