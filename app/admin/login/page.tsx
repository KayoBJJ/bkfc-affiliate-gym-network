import { redirect } from "next/navigation";
import Image from "next/image";
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
    <main className="admin-login-shell">
      <section className="admin-login-brand-panel">
        <div className="admin-login-brand">
          <Image src="/bkfc-logo.png" alt="BKFC" width={260} height={62} priority />
          <span>Affiliate Network</span>
        </div>
        <div className="admin-login-intro">
          <p className="eyebrow">Internal Operations</p>
          <h1>Control<br />Centre</h1>
          <p>Secure access for authorized BKFC operators managing the affiliate intake pipeline.</p>
        </div>
        <div className="admin-login-classification">
          <span aria-hidden="true" />
          Restricted workspace
        </div>
      </section>

      <div className="admin-login-form-panel">
        <LoginForm initialError={searchParams?.error} />
        <p className="admin-login-security-note">Protected BKFC operations environment</p>
      </div>
    </main>
  );
}
