import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AdminBreadcrumb } from "@/components/AdminBreadcrumb";
import { GlobalLoadingBar } from "@/components/GlobalLoadingBar";
import { AdminBottomNav } from "@/components/admin/AdminBottomNav";
import { MobilePageHeader } from "@/components/admin/MobilePageHeader";
import { CommandPalette, CommandPaletteTrigger } from "@/components/CommandPalette";
import { BugReporter } from "@/components/BugReporter";
import { AiAssistant } from "@/components/AiAssistant";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";

function ShortcutsBridge() {
  useGlobalShortcuts();
  return null;
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <GlobalLoadingBar />
      <CommandPalette />
      <ShortcutsBridge />
      <div className="min-h-screen flex w-full bg-canvas">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header mobile contextual — voltar + título da página */}
          <MobilePageHeader />
          {/* Header desktop — sticky com hairline sutil; aloja o command-trigger */}
          <header className="hidden lg:flex sticky top-0 z-30 h-12 items-center justify-end gap-2 px-6 bg-canvas/85 backdrop-blur-md border-b border-hairline/80">
            <CommandPaletteTrigger />
          </header>
          <AdminBreadcrumb />
          <main className="flex-1 safe-pb-nav lg:pb-0">{children}</main>
        </div>
      </div>
      <AdminBottomNav />
      <BugReporter />
      <AiAssistant />
    </SidebarProvider>
  );
}
