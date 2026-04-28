import type { ReactNode } from "react";
import Link from "next/link";
import { logoutAdminAction } from "@/app/admin/actions";

type AdminShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AdminShell({ title, description, children }: AdminShellProps) {
  return (
    <main className="page-shell admin-page-shell">
      <header className="hero admin-hero">
        <div className="admin-topbar">
          <div>
            <p className="eyebrow">BKFC Affiliate Admin</p>
            <h1 className="admin-title">{title}</h1>
            <p className="hero-supporting admin-subtitle">{description}</p>
          </div>

          <nav className="admin-nav" aria-label="Admin">
            <Link href="/admin/applications" className="section-nav-link">
              Applications
            </Link>
            <form action={logoutAdminAction}>
              <button type="submit" className="section-nav-link admin-nav-button">
                Logout
              </button>
            </form>
          </nav>
        </div>
      </header>

      {children}
    </main>
  );
}
