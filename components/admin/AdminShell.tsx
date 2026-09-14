import type { ReactNode } from "react";
import Image from "next/image";
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
      <div className="admin-control-centre">
        <aside className="admin-sidebar">
          <Link href="/admin/applications" className="admin-sidebar-brand" aria-label="BKFC affiliate operations home">
            <Image src="/bkfc-logo.png" alt="BKFC" width={200} height={48} priority />
            <span className="admin-sidebar-brand-copy">
              <strong>Affiliate Network</strong>
              <small>Control Centre</small>
            </span>
          </Link>

          <nav className="admin-sidebar-nav" aria-label="Admin navigation">
            <div className="admin-nav-group">
              <p className="admin-nav-group-label">Operations</p>
              <Link href="/admin/applications" className="admin-sidebar-link active" aria-current="page">
                <span className="admin-sidebar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 5.5h16M4 12h16M4 18.5h16" />
                    <path d="M7 3.5v4M14 10v4M18 16.5v4" />
                  </svg>
                </span>
                <span>Applications</span>
              </Link>
            </div>

            <div className="admin-nav-group admin-nav-group-secondary">
              <p className="admin-nav-group-label">Workspace</p>
              <Link href="/" className="admin-sidebar-link">
                <span className="admin-sidebar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M14 5h5v5M19 5l-8 8" />
                    <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
                  </svg>
                </span>
                <span>Program site</span>
              </Link>
            </div>
          </nav>

          <div className="admin-sidebar-footer">
            <div className="admin-access-state">
              <span aria-hidden="true" />
              <div>
                <strong>Internal Access</strong>
                <small>Authorized staff</small>
              </div>
            </div>
            <form action={logoutAdminAction}>
              <button type="submit" className="admin-sidebar-link admin-logout-button">
                <span className="admin-sidebar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M15 8l4 4-4 4M9 12h10" />
                  </svg>
                </span>
                <span>Sign out</span>
              </button>
            </form>
          </div>
        </aside>

        <div className="admin-workspace">
          <header className="admin-command-bar">
            <div className="admin-command-context">
              <span className="admin-command-mark" aria-hidden="true">BKFC</span>
              <div>
                <p>Operations</p>
                <strong>Affiliate Network</strong>
              </div>
            </div>
            <div className="admin-command-status">
              <span aria-hidden="true" />
              Internal workspace
            </div>
          </header>

          <div className="admin-content">
            <header className="admin-hero">
              <div className="admin-topbar">
                <p className="eyebrow">Affiliate Operations</p>
                <h1 className="admin-title">{title}</h1>
                <p className="hero-supporting admin-subtitle">{description}</p>
              </div>
            </header>

            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
