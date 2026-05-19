import "../styles/globals.css";
import type { AppProps } from "next/app";
import Sidebar from "@/components/sidebar/sidebar";
import { useCallback, useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

export default function App({ Component, pageProps }: AppProps) {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    const prefersLight =
      window.matchMedia?.("(prefers-color-scheme: light)")?.matches ?? false;
    const nextTheme: ThemeMode =
      storedTheme === "light" || storedTheme === "dark"
        ? (storedTheme as ThemeMode)
        : prefersLight
          ? "light"
          : "dark";

    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const nextTheme: ThemeMode = prev === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", nextTheme);
      localStorage.setItem("theme", nextTheme);
      return nextTheme;
    });
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar theme={theme} onToggleTheme={toggleTheme} />
      <div style={{ flex: 1, marginLeft: "250px" }}>
        <Component {...pageProps} />
      </div>
    </div>
  );
}
