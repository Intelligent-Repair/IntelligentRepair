"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
<<<<<<< HEAD
import type { ThemeProviderProps } from "next-themes";
=======
import { type ThemeProviderProps } from "next-themes/dist/types";
>>>>>>> rescue/ui-stable

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

