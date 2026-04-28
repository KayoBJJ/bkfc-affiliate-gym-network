import { redirect } from "next/navigation";
import { LoginForm } from "@/app/admin/login/LoginForm";
import { getAdminSession } from "@/lib/admin/auth";

type AdminLoginPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const { user, isAllowed } = await getAdminSession();

  if (user && isAllowed) {
    redirect("/admin/applications");
  }

  return (
    <main className="page-shell admin-page-shell">
      <section className="hero admin-hero admin-login-hero">
        <div className="admin-topbar">
          <div>
            <p className="eyebrow">BKFC Affiliate Admin</p>
            <h1 className="admin-title">Secure Dashboard Access</h1>
            <p className="hero-supporting admin-subtitle">
              Authorized BKFC operators can sign in here to review affiliate gym applications
              and manage the intake pipeline.
            </p>
          </div>
        </div>
      </section>

      <LoginForm initialError={searchParams?.error} />
    </main>
  );
}

