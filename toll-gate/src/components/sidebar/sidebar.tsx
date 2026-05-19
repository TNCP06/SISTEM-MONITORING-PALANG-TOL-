import { BarChart2, Database, LayoutDashboard, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import Image from "next/image";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

const Sidebar = ({ theme, onToggleTheme }: SidebarProps) => {
  const router = useRouter();
  const isLight = theme === "light";
  const logoSrc = isLight
    ? "/logo-horizontal-light.svg"
    : "/logo-horizontal.svg";

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoSection}>
        <Image
          src={logoSrc}
          alt="Toll Gate Logo"
          width={500}
          height={70}
          priority
        />
      </div>

      <nav className={styles.nav}>
        <Link
          href="/"
          className={`${styles.navItem} ${router.pathname === "/" ? styles.active : ""}`}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </Link>
        <Link
          href="/analytics"
          className={`${styles.navItem} ${router.pathname === "/analytics" ? styles.active : ""}`}
        >
          <BarChart2 size={20} />
          <span>Analytics</span>
        </Link>
        <Link
          href="/management"
          className={`${styles.navItem} ${router.pathname === "/management" ? styles.active : ""}`}
        >
          <Database
            size={20}
            fill={router.pathname === "/management" ? "currentColor" : "none"}
          />
          <span>Management</span>
        </Link>
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.statusSection}>
          <span className={styles.statusLabel}>SYSTEM STATUS</span>
          <span className={styles.statusText}>ONLINE</span>
        </div>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={onToggleTheme}
          aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
          aria-pressed={isLight}
          title={isLight ? "Switch to dark mode" : "Switch to light mode"}
        >
          {isLight ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
