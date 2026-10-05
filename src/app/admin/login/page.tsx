import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import AdminLogin from "@/components/admin/AdminLogin";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-4">
      <Logo size="lg" />
      <AdminLogin />
    </main>
  );
}