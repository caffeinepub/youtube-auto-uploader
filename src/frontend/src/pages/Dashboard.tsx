import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActor } from "@/hooks/useActor";
import { cn } from "@/lib/utils";
import {
  addHistoryEntry,
  getChannel,
  getHistory,
  getQueue,
  getScheduler,
  removeFromQueue,
  saveScheduler,
} from "@/utils/channelStorage";
import { getAccessToken, uploadDriveFileToYouTube } from "@/utils/uploadUtils";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Upload,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// 1 hour between uploads — no daily cap (YouTube API quota is the real limit)
const UPLOAD_INTERVAL_MS = 3_600_000;
const MAX_UPLOADS_PER_DAY = 9999;

interface DashboardProps {
  channelId: string;
}

export function Dashboard({ channelId }: DashboardProps) {
  const channel = getChannel(channelId);
  const { actor } = useActor();
  const oauthConfig = channel
    ? {
        clientId: channel.clientId,
        clientSecret: channel.clientSecret,
        refreshToken: channel.refreshToken,
        driveFolderId: channel.driveFolderId,
      }
    : null;

  const scheduler = getScheduler(channelId);
  const [queue, setQueue] = useState(() => getQueue(channelId).items);
  const [history, setHistory] = useState(() => getHistory(channelId).entries);
  const [uploadsToday, setUploadsToday] = useState(scheduler.uploadsToday);
  const [countdown, setCountdown] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const lastUploadRef = useRef<number>(scheduler.lastUploadTime || 0);

  // Refs to hold latest values for use inside stable interval
  const isUploadingRef = useRef(false);
  const uploadsTodayRef = useRef(uploadsToday);
  const channelIdRef = useRef(channelId);
  const oauthConfigRef = useRef(oauthConfig);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actorRef = useRef<any>(null);

  // Keep refs in sync with latest state/props every render
  isUploadingRef.current = isUploading;
  uploadsTodayRef.current = uploadsToday;
  channelIdRef.current = channelId;
  oauthConfigRef.current = oauthConfig;
  actorRef.current = actor;

  // Stable ref for tryUpload — updated every render with fresh closures
  const tryUploadRef = useRef<() => Promise<void>>(async () => {});
  tryUploadRef.current = async () => {
    const cfg = oauthConfigRef.current;
    if (!cfg?.refreshToken) return;
    if (isUploadingRef.current) return;
    if (uploadsTodayRef.current >= MAX_UPLOADS_PER_DAY) return;

    const cid = channelIdRef.current;
    const now = Date.now();
    const elapsed = now - lastUploadRef.current;
    if (elapsed < UPLOAD_INTERVAL_MS && lastUploadRef.current !== 0) return;

    const currentQueue = getQueue(cid).items;
    if (currentQueue.length === 0) return;

    const sorted = [...currentQueue].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    const next = sorted[0];
    if (!next) return;

    isUploadingRef.current = true;
    setIsUploading(true);
    setUploadProgress(0);
    toast.loading(`Uploading: ${next.fileName}...`, { id: "upload" });

    try {
      const token = await getAccessToken(
        cfg.clientId,
        cfg.clientSecret,
        cfg.refreshToken,
      );
      const ch = getChannel(cid);
      const ytId = await uploadDriveFileToYouTube(
        next.driveFileId,
        next.fileName,
        token,
        ch?.title || undefined,
        ch?.caption || undefined,
        (pct) => setUploadProgress(pct),
      );

      const uploadTime = Date.now();
      lastUploadRef.current = uploadTime;

      const s = getScheduler(cid);
      const todayStr = new Date().toDateString();
      const newUploadsToday =
        s.lastUploadDate === todayStr ? s.uploadsToday + 1 : 1;
      saveScheduler(cid, {
        ...s,
        uploadsToday: newUploadsToday,
        lastUploadDate: todayStr,
        lastUploadTime: uploadTime,
      });
      setUploadsToday(newUploadsToday);

      removeFromQueue(cid, next.driveFileId);
      setQueue(getQueue(cid).items);

      addHistoryEntry(cid, {
        driveFileId: next.driveFileId,
        fileName: next.fileName,
        youtubeVideoId: ytId,
        uploadedAt: uploadTime,
        status: "success",
        errorMessage: "",
      });
      setHistory(getHistory(cid).entries);

      toast.success(`Uploaded: ${next.fileName}`, {
        id: "upload",
        description: `youtube.com/watch?v=${ytId}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Upload failed", { id: "upload", description: msg });
      addHistoryEntry(cid, {
        driveFileId: next.driveFileId,
        fileName: next.fileName,
        youtubeVideoId: "",
        uploadedAt: Date.now(),
        status: "error",
        errorMessage: msg,
      });
      setHistory(getHistory(cid).entries);
      lastUploadRef.current = Date.now();
    } finally {
      isUploadingRef.current = false;
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  useEffect(() => {
    const s = getScheduler(channelId);
    setUploadsToday(s.uploadsToday);
    lastUploadRef.current = s.lastUploadTime || 0;
    setQueue(getQueue(channelId).items);
    setHistory(getHistory(channelId).entries);
  }, [channelId]);

  // Single combined interval: countdown + upload trigger
  useEffect(() => {
    let firedForCurrentCycle = false;

    const tick = () => {
      const now = Date.now();
      const elapsed = now - lastUploadRef.current;
      const remaining = Math.max(0, UPLOAD_INTERVAL_MS - elapsed);
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdown(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );

      if (remaining === 0) {
        if (!firedForCurrentCycle) {
          const cfg = oauthConfigRef.current;
          const queueEmpty = getQueue(channelIdRef.current).items.length === 0;
          if (cfg?.refreshToken && !isUploadingRef.current && !queueEmpty) {
            firedForCurrentCycle = true;
            tryUploadRef.current();
          }
        }
      } else {
        firedForCurrentCycle = false;
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Cron trigger polling — every 30 seconds
  useEffect(() => {
    const checkCronTrigger = async () => {
      const act = actorRef.current;
      if (!act) return;
      try {
        const trigger = await act.getPendingTrigger(channelIdRef.current);
        if (trigger !== null && trigger !== undefined) {
          const cfg = oauthConfigRef.current;
          const queueEmpty = getQueue(channelIdRef.current).items.length === 0;
          await act.clearPendingTrigger(channelIdRef.current);
          if (cfg?.refreshToken && !isUploadingRef.current && !queueEmpty) {
            toast.info("Cron trigger received! Starting upload...");
            tryUploadRef.current();
          }
        }
      } catch {
        // Polling failure is silent — don't disrupt the UI
      }
    };

    checkCronTrigger();
    const id = setInterval(checkCronTrigger, 30_000);
    return () => clearInterval(id);
  }, []);

  const nextUploadTime = () => {
    if (!lastUploadRef.current) return "Now";
    const t = new Date(lastUploadRef.current + UPLOAD_INTERVAL_MS);
    return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const sortedQueue = [...queue].sort((a, b) => a.orderIndex - b.orderIndex);
  const recentHistory = [...history]
    .sort((a, b) => b.uploadedAt - a.uploadedAt)
    .slice(0, 5);

  const isCronReady = !!oauthConfig?.refreshToken;

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div />
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Bell size={18} />
          </button>
          {oauthConfig?.refreshToken ? (
            <div className="flex items-center gap-1.5 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-accent" />
              <span className="text-green-accent font-medium hidden sm:inline">
                Connected
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm">
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="text-yellow-400 font-medium hidden sm:inline">
                Not Connected
              </span>
            </div>
          )}
        </div>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-2xl md:text-3xl font-bold mb-4 text-foreground"
      >
        Upload Dashboard
      </motion.h1>

      {/* Status banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "flex items-center gap-2 rounded-lg px-4 py-2.5 mb-4 text-sm",
          isCronReady
            ? "bg-green-accent/10 border border-green-accent/30 text-green-accent"
            : "bg-yellow-400/10 border border-yellow-400/30 text-yellow-400",
        )}
      >
        {isCronReady ? (
          <>
            <Zap size={16} className="shrink-0" />
            Auto-upload active. Uploads run every hour — tab doesn&apos;t need
            to stay open if you set up the cron URL in Settings.
          </>
        ) : (
          <>
            <AlertTriangle size={16} className="shrink-0" />
            Go to Settings to configure OAuth first.
          </>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        data-ocid="dashboard.section"
        className={cn(
          "flex items-center gap-3 rounded-xl px-5 py-4 mb-6 border",
          oauthConfig?.refreshToken
            ? "bg-green-accent/10 border-green-accent/30 text-green-accent"
            : "bg-yellow-400/10 border-yellow-400/30 text-yellow-400",
        )}
      >
        {oauthConfig?.refreshToken ? (
          <>
            <CheckCircle2 size={20} className="shrink-0" />
            <div>
              <div className="font-semibold">OAuth Connected</div>
              <div className="text-sm opacity-80">
                YouTube &amp; Google Drive access authorized. Auto-upload
                active.
              </div>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle size={20} className="shrink-0" />
            <div>
              <div className="font-semibold">OAuth Not Configured</div>
              <div className="text-sm opacity-80">
                Go to Settings to authorize Google &amp; YouTube access.
              </div>
            </div>
          </>
        )}
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card data-ocid="dashboard.card" className="bg-card border-border">
            <CardContent className="p-5 flex items-center gap-5">
              <div className="w-[100px] h-[100px] flex items-center justify-center shrink-0">
                <div className="w-16 h-16 rounded-full bg-yt-red/10 border-2 border-yt-red/30 flex items-center justify-center">
                  <Upload size={28} className="text-yt-red" />
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-sm mb-1">
                  Today&apos;s Uploads
                </div>
                <div className="font-display text-3xl font-bold text-foreground">
                  {uploadsToday}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Videos uploaded today
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card data-ocid="scheduler.card" className="bg-card border-border">
            <CardContent className="p-5 flex items-center gap-5">
              <div className="w-[100px] h-[100px] flex items-center justify-center">
                <div className="text-center">
                  <Clock size={28} className="text-blue-link mx-auto mb-1" />
                  <div className="font-display text-lg font-bold text-foreground tabular-nums">
                    {countdown}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-muted-foreground text-sm mb-1">
                  Next Upload In
                </div>
                <div className="font-display text-xl font-bold text-foreground tabular-nums">
                  {countdown}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Scheduled at {nextUploadTime()}
                </div>
                {isUploading && (
                  <div className="mt-2 space-y-1">
                    <Badge
                      className="bg-yt-red text-white text-xs"
                      data-ocid="upload.loading_state"
                    >
                      Uploading... {uploadProgress}%
                    </Badge>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className="bg-yt-red h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-3"
        >
          <Card className="bg-card border-border h-full">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Upload size={18} className="text-yt-red" />
                Current Upload Queue ({sortedQueue.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedQueue.length === 0 ? (
                <div
                  data-ocid="queue.empty_state"
                  className="text-center py-8 text-muted-foreground"
                >
                  <Upload size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No videos in queue</p>
                  <p className="text-xs mt-1">
                    Add videos from the Upload Queue page
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[280px] pr-2">
                  <div className="space-y-2">
                    {sortedQueue.map((item, i) => (
                      <div
                        key={item.driveFileId}
                        data-ocid={`queue.item.${i + 1}`}
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <span className="w-7 h-7 rounded-full bg-yt-red/20 text-yt-red text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-sm font-medium truncate">
                          {item.fileName}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs shrink-0 border-yellow-400/30 text-yellow-400 bg-yellow-400/10"
                        >
                          Pending
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="lg:col-span-2"
        >
          <Card className="bg-card border-border h-full">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Clock size={18} className="text-blue-link" />
                Upload History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentHistory.length === 0 ? (
                <div
                  data-ocid="history.empty_state"
                  className="text-center py-8 text-muted-foreground"
                >
                  <Clock size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No uploads yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[280px] pr-2">
                  <div className="space-y-2">
                    {recentHistory.map((entry, i) => (
                      <div
                        key={entry.id}
                        data-ocid={`history.item.${i + 1}`}
                        className="flex flex-col gap-1 p-3 rounded-lg bg-secondary/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate flex-1">
                            {entry.fileName}
                          </span>
                          <Badge
                            className={cn(
                              "text-xs shrink-0",
                              entry.status === "success"
                                ? "bg-green-accent/20 text-green-accent border-green-accent/30"
                                : "bg-destructive/20 text-destructive border-destructive/30",
                            )}
                            variant="outline"
                          >
                            {entry.status}
                          </Badge>
                        </div>
                        {entry.youtubeVideoId && (
                          <a
                            href={`https://youtu.be/${entry.youtubeVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-link hover:underline"
                          >
                            youtu.be/{entry.youtubeVideoId}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
