"use client";

import { useEffect, useState } from "react";
import {
  formatExactTimestamp,
  formatLocalDate,
  getGreetingForHour,
  timeAgo,
} from "@/lib/utils";

interface HeroGreetingProps {
  initialGreeting?: string;
  initialDate?: string;
}

export function HeroGreeting({
  initialGreeting = "Good morning",
  initialDate = "",
}: HeroGreetingProps) {
  const [greeting, setGreeting] = useState<string>(initialGreeting);
  const [dateStr, setDateStr] = useState<string>(initialDate);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setGreeting(getGreetingForHour(now.getHours()));
      setDateStr(formatLocalDate(now));
    };

    updateTime();
    // Update every 30 seconds to catch morning/afternoon/evening & date transitions promptly
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div className="mb-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-sage" />
        <span suppressHydrationWarning>
          Property-to-Ad Creative Agent · {dateStr || initialDate}
        </span>
      </div>
      <h1 className="font-display max-w-xl text-[34px] font-medium leading-[1.05] md:text-[46px]">
        <span suppressHydrationWarning>{greeting}</span>. Property photos in,{" "}
        <span className="gold-text italic">ready-to-post campaigns</span> out.
      </h1>
    </>
  );
}

export function LiveTimeAgo({
  date,
  className,
}: {
  date: Date | string | null | undefined;
  className?: string;
}) {
  const [text, setText] = useState<string>(() => timeAgo(date));

  useEffect(() => {
    const update = () => setText(timeAgo(date));
    update();
    const timer = setInterval(update, 20000);
    return () => clearInterval(timer);
  }, [date]);

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

export function LiveExactTime({
  date,
  className,
}: {
  date: Date | string | null | undefined;
  className?: string;
}) {
  const [exact, setExact] = useState<string>(() => formatExactTimestamp(date));

  useEffect(() => {
    const update = () => setExact(formatExactTimestamp(date));
    update();
  }, [date]);

  const iso = date ? (typeof date === "string" ? date : date.toISOString()) : "";

  return (
    <time
      dateTime={iso}
      className={className}
      title={exact}
      suppressHydrationWarning
    >
      {exact}
    </time>
  );
}

export function LiveActivityTimestamp({
  date,
}: {
  date: Date | string | null | undefined;
}) {
  return (
    <span className="shrink-0 text-right">
      <LiveTimeAgo date={date} className="block font-mono text-[9px] text-faint" />
      <LiveExactTime date={date} className="block whitespace-nowrap font-mono text-[9px] text-mute" />
    </span>
  );
}

