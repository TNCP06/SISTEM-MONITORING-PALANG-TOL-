import { Dashboard } from "@/components/dashboard/dashboard";
import Head from "next/head";
import styles from "@/styles/dashboard.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Dashboard | TapToll</title>
      </Head>

      <Dashboard />
    </div>
  );
}
