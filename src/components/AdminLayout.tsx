import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AdminBreadcrumb } from "@/components/AdminBreadcrumb";
import { GlobalLoadingBar } from "@/components/GlobalLoadingBar";
import { AdminBottomNav } from "@/components/admin/AdminBottomNav";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <GlobalLoadingBar />
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-10 flex items-center border-b border-border bg-card shrink-0 px-2 lg:hidden">
            <SidebarTrigger />
          </header>
          <AdminBreadcrumb />
          <main className="flex-1 pb-16 lg:pb-0">{children}</main>
        </div>
      </div>
      <AdminBottomNav />
    </SidebarProvider>
  );
}
