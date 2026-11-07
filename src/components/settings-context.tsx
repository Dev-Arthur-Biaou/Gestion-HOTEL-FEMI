"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { SettingsDTO } from "@/lib/types";

const SettingsContext = createContext<{
  settings: SettingsDTO;
  setSettings: (next: SettingsDTO) => void;
} | null>(null);

export function SettingsProvider({
  value,
  children,
}: {
  value: SettingsDTO;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<SettingsDTO>(value);
  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings doit être utilisé dans SettingsProvider");
  return ctx;
}
