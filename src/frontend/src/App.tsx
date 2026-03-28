import { ChannelTabBar } from "@/components/ChannelTabBar";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Dashboard } from "@/pages/Dashboard";
import { DriveConnect } from "@/pages/DriveConnect";
import { Settings } from "@/pages/Settings";
import { UploadHistory } from "@/pages/UploadHistory";
import { UploadQueue } from "@/pages/UploadQueue";
import {
  ensureDefaultChannel,
  getChannel,
  setActiveChannelId,
} from "@/utils/channelStorage";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export type Page = "dashboard" | "settings" | "queue" | "history" | "drive";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeChannelId, setActiveChannelIdState] = useState<string>(() => {
    return ensureDefaultChannel();
  });
  const [channelVersion, setChannelVersion] = useState(0);

  const activeChannel = getChannel(activeChannelId);
  const isConnected = !!activeChannel?.refreshToken;

  // Check URL for OAuth callback code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      setPage("settings");
      toast.info("Complete OAuth setup in Settings", {
        description: "Authorization code received",
      });
      sessionStorage.setItem("oauth_code", code);
    }
  }, []);

  // If no config, go to settings
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeChannelId triggers re-check
  useEffect(() => {
    if (!isConnected) {
      setPage("settings");
    }
  }, [isConnected, activeChannelId]);

  const handleSwitchChannel = (id: string) => {
    setActiveChannelId(id);
    setActiveChannelIdState(id);
    setChannelVersion((v) => v + 1);
  };

  const handleNavigate = (p: Page) => {
    setPage(p);
    setMobileNavOpen(false);
  };

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return (
          <Dashboard
            channelId={activeChannelId}
            key={`dash-${activeChannelId}`}
          />
        );
      case "settings":
        return (
          <Settings
            channelId={activeChannelId}
            key={`settings-${activeChannelId}`}
            onSaved={() => {
              setChannelVersion((v) => v + 1);
              setPage("dashboard");
            }}
          />
        );
      case "queue":
        return (
          <UploadQueue
            channelId={activeChannelId}
            key={`queue-${activeChannelId}`}
          />
        );
      case "history":
        return (
          <UploadHistory
            channelId={activeChannelId}
            key={`history-${activeChannelId}`}
          />
        );
      case "drive":
        return (
          <DriveConnect
            channelId={activeChannelId}
            key={`drive-${activeChannelId}`}
          />
        );
      default:
        return (
          <Dashboard
            channelId={activeChannelId}
            key={`dash-${activeChannelId}`}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden dark">
      {/* Channel tab bar — full width at the very top */}
      <ChannelTabBar
        activeChannelId={activeChannelId}
        onSwitch={handleSwitchChannel}
        onChannelsChange={() => setChannelVersion((v) => v + 1)}
        key={channelVersion}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activePage={page}
          onNavigate={handleNavigate}
          isConnected={isConnected}
          isMobileOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* Mobile header with hamburger */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
            <button
              type="button"
              data-ocid="nav.open_modal_button"
              onClick={() => setMobileNavOpen(true)}
              className="p-1.5 rounded-lg text-foreground/70 hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-yt-red flex items-center justify-center">
                <span className="text-white text-xs font-bold">YT</span>
              </div>
              <span className="font-display font-bold text-sm text-foreground">
                Auto Uploader
              </span>
            </div>
          </div>
          {renderPage()}
        </div>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
