import type { Page } from "@/App";
import { cn } from "@/lib/utils";
import {
  Clock,
  HardDrive,
  HelpCircle,
  LayoutDashboard,
  List,
  Settings,
  X,
  Youtube,
} from "lucide-react";

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isConnected: boolean;
  isMobileOpen?: boolean;
  onClose?: () => void;
}

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "drive", label: "Google Drive", icon: <HardDrive size={18} /> },
  { id: "queue", label: "Upload Queue", icon: <List size={18} /> },
  { id: "history", label: "Upload History", icon: <Clock size={18} /> },
  { id: "settings", label: "Settings", icon: <Settings size={18} /> },
];

export function Sidebar({
  activePage,
  onNavigate,
  isConnected,
  isMobileOpen = false,
  onClose,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/60 z-40 md:hidden w-full h-full cursor-default"
          onClick={onClose}
          aria-label="Close navigation"
          tabIndex={-1}
        />
      )}

      <aside
        className={cn(
          "w-64 flex flex-col bg-sidebar border-r border-sidebar-border h-full shrink-0 transition-transform duration-300",
          // Desktop: always visible
          "md:relative md:translate-x-0",
          // Mobile: fixed overlay
          "fixed inset-y-0 left-0 z-50 md:static md:z-auto",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="px-5 py-6 flex items-center gap-3 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-yt-red flex items-center justify-center shrink-0">
            <Youtube size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="font-display font-700 text-sm text-sidebar-foreground leading-tight">
              YouTube
            </div>
            <div className="font-display font-700 text-xs text-sidebar-foreground/70 leading-tight">
              Auto Uploader
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            type="button"
            onClick={onClose}
            className="md:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors p-1"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav
          className="flex-1 px-3 py-4 space-y-1"
          aria-label="Main navigation"
        >
          {navItems.map((item) => (
            <button
              type="button"
              key={item.id}
              data-ocid={`nav.${item.id}.link`}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                activePage === item.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Status */}
        <div className="px-3 pb-4">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground/50">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-green-accent" : "bg-yellow-400",
              )}
            />
            {isConnected ? "OAuth Connected" : "Not Connected"}
          </div>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          >
            <HelpCircle size={18} />
            Help
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 border-t border-sidebar-border pt-3">
          <p className="text-xs text-sidebar-foreground/40">
            &copy; {new Date().getFullYear()}{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-sidebar-foreground/60 transition-colors"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </aside>
    </>
  );
}
