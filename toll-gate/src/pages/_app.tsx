import "../styles/globals.css";
import type { AppProps } from "next/app";
import Sidebar from "@/components/sidebar/sidebar";
import { useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useRouter } from "next/router";

type ThemeMode = "light" | "dark";

export default function App({ Component, pageProps }: AppProps) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();

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

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  useEffect(() => {
    const handleRouteChange = () => setIsSidebarOpen(false);
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  useEffect(() => {
    if (!isSidebarOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen]);

  return (
    <div className="appShell">
      <Sidebar
        theme={theme}
        onToggleTheme={toggleTheme}
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        onNavigate={closeSidebar}
      />
      <button
        type="button"
        className={`sidebarOverlay ${isSidebarOpen ? "sidebarOverlayVisible" : ""}`}
        aria-label="Close sidebar"
        onClick={closeSidebar}
        tabIndex={isSidebarOpen ? 0 : -1}
      />
      <div className="appContent">
        <header className="mobileHeader">
          <button
            type="button"
            className="hamburgerButton"
            aria-label="Open sidebar"
            aria-controls="app-sidebar"
            aria-expanded={isSidebarOpen}
            onClick={toggleSidebar}
          >
            <Menu size={20} />
          </button>
          <span className="mobileHeaderTitle">TAPTOLL</span>
          <div style={{ width: 40 }} />
        </header>
        <Component {...pageProps} />
      </div>
    </div>
  );
}
