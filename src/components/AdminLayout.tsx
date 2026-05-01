import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AdminBreadcrumb } from "@/components/AdminBreadcrumb";
import { GlobalLoadingBar } from "@/components/GlobalLoadingBar";
import { AdminBottomNav } from "@/components/admin/AdminBottomNav";
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
          {/* Header mobile — sticky para sempre dar contexto */}
          <header className="sticky top-0 z-30 h-12 flex items-center justify-between border-b border-hairline bg-surface-1/85 backdrop-blur-md shrink-0 px-3 lg:hidden">
            <SidebarTrigger />
            <CommandPaletteTrigger />
          </header>
          {/* Header desktop — sticky com hairline sutil; aloja o command-trigger */}
          <header className="hidden lg:flex sticky top-0 z-30 h-12 items-center justify-end gap-2 px-6 bg-canvas/85 backdrop-blur-md border-b border-hairline/80">
            <CommandPaletteTrigger />
          </header>
          <AdminBreadcrumb />
          <main className="flex-1 pb-16 lg:pb-0">{children}</main>
        </div>
      </div>
      <AdminBottomNav />
      <BugReporter />
      <AiAssistant />
    </SidebarProvider>
  );
}
