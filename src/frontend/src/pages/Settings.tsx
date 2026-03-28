import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
import { getChannel, updateChannel } from "@/utils/channelStorage";
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Key,
  Loader2,
  MessageSquare,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SettingsProps {
  channelId: string;
  onSaved: () => void;
}

function getCronUrl(channelId: string): string {
  return `${window.location.origin}/trigger-upload?channelId=${channelId}`;
}

export function Settings({ channelId, onSaved }: SettingsProps) {
  const channel = getChannel(channelId);
  const { actor } = useActor();

  const [clientId, setClientId] = useState(channel?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState(channel?.clientSecret ?? "");
  const [folderId, setFolderId] = useState(channel?.driveFolderId ?? "");
  const [refreshToken, setRefreshToken] = useState(channel?.refreshToken ?? "");
  const [captionText, setCaptionText] = useState(channel?.caption ?? "");
  const [titleText, setTitleText] = useState(channel?.title ?? "");
  const [isExchanging, setIsExchanging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingCaption, setIsSavingCaption] = useState(false);

  const cronUrl = getCronUrl(channelId);

  useEffect(() => {
    const code = sessionStorage.getItem("oauth_code");
    if (!code || !clientId || !clientSecret) return;
    sessionStorage.removeItem("oauth_code");
    setIsExchanging(true);
    const redirectUri = window.location.origin + window.location.pathname;
    fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.refresh_token) {
          setRefreshToken(data.refresh_token);
          toast.success("OAuth authorized! Save your settings below.");
        } else {
          throw new Error(
            data.error_description || "No refresh token received",
          );
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error("OAuth exchange failed", { description: msg });
      })
      .finally(() => setIsExchanging(false));
  }, [clientId, clientSecret]);

  const handleAuthorize = () => {
    if (!clientId) {
      toast.error("Enter Client ID first");
      return;
    }
    const redirectUri = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube",
      ].join(" "),
      access_type: "offline",
      prompt: "consent",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncToBackend = async (
    act: any,
    overrides?: {
      clientId?: string;
      clientSecret?: string;
      refreshToken?: string;
      driveFolderId?: string;
      title?: string;
      caption?: string;
    },
  ) => {
    if (!act) return;
    try {
      await act.saveChannelConfig(channelId, {
        clientId: overrides?.clientId ?? clientId,
        clientSecret: overrides?.clientSecret ?? clientSecret,
        refreshToken: overrides?.refreshToken ?? refreshToken,
        driveFolderId: overrides?.driveFolderId ?? folderId,
        title: overrides?.title ?? titleText,
        caption: overrides?.caption ?? captionText,
      });
    } catch {
      // Sync failure is non-blocking — local save already succeeded
    }
  };

  const handleSave = async () => {
    if (!clientId || !clientSecret) {
      toast.error("Client ID and Client Secret are required");
      return;
    }
    setIsSaving(true);
    try {
      updateChannel(channelId, {
        clientId,
        clientSecret,
        refreshToken,
        driveFolderId: folderId,
        caption: captionText,
        title: titleText,
      });
      await syncToBackend(actor);
      toast.success("Settings saved!");
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to save settings", { description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCaption = async () => {
    setIsSavingCaption(true);
    try {
      updateChannel(channelId, {
        caption: captionText,
        title: titleText,
      });
      await syncToBackend(actor, { title: titleText, caption: captionText });
      toast.success("Title & description saved!");
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to save", { description: msg });
    } finally {
      setIsSavingCaption(false);
    }
  };

  const handleCopyCronUrl = () => {
    navigator.clipboard.writeText(cronUrl).then(() => {
      toast.success("Cron URL copied to clipboard!");
    });
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-2xl md:text-3xl font-bold mb-6 text-foreground"
      >
        Settings
      </motion.h1>

      <div className="max-w-2xl space-y-6">
        {/* OAuth Credentials */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Key size={18} className="text-yt-red" />
                Google OAuth Credentials
              </CardTitle>
              <CardDescription>
                Create OAuth 2.0 credentials in Google Cloud Console. Set the
                redirect URI to your app URL.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  data-ocid="settings.input"
                  placeholder="your-client-id.apps.googleusercontent.com"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  data-ocid="settings.input"
                  type="password"
                  placeholder="GOCSPX-..."
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="folderId">Google Drive Folder ID</Label>
                <Input
                  id="folderId"
                  data-ocid="settings.input"
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="bg-secondary border-border"
                />
                <p className="text-xs text-muted-foreground">
                  From your Drive folder URL:
                  drive.google.com/drive/folders/&lt;FOLDER_ID&gt;
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="refreshToken">
                  Refresh Token (auto-filled after authorization)
                </Label>
                <Input
                  id="refreshToken"
                  data-ocid="settings.input"
                  placeholder="Authorize with Google to auto-fill this"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="bg-card border-border">
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground mb-2">
                Add this as an Authorized Redirect URI in Google Cloud Console:
              </p>
              <code className="block bg-secondary rounded px-3 py-2 text-sm text-blue-link break-all">
                {window.location.origin + window.location.pathname}
              </code>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap gap-3"
        >
          <Button
            data-ocid="settings.primary_button"
            onClick={handleAuthorize}
            variant="outline"
            className="gap-2 border-blue-link text-blue-link hover:bg-blue-link/10"
            disabled={isExchanging}
          >
            {isExchanging ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ExternalLink size={16} />
            )}
            Authorize with Google
          </Button>

          <Button
            data-ocid="settings.submit_button"
            onClick={handleSave}
            className="gap-2 bg-yt-red hover:bg-yt-red/80 text-white"
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Save Settings
          </Button>
        </motion.div>

        {refreshToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-green-accent text-sm"
            data-ocid="settings.success_state"
          >
            <CheckCircle2 size={16} />
            OAuth is configured and active
          </motion.div>
        )}

        {/* Caption / Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-link" />
                Video Title &amp; Description
              </CardTitle>
              <CardDescription>
                Set a shared title and description for all uploaded videos in
                this channel. Leave title empty to use the filename.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="videoTitle">
                  Video Title (applies to all videos)
                </Label>
                <Input
                  id="videoTitle"
                  data-ocid="caption.input"
                  placeholder="Leave empty to use filename"
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="videoCaption">Video Description</Label>
                <Textarea
                  id="videoCaption"
                  data-ocid="caption.textarea"
                  placeholder="Add a description that will be used for all uploaded videos"
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  className="bg-secondary border-border min-h-[120px]"
                />
              </div>
              <Button
                data-ocid="caption.save_button"
                onClick={handleSaveCaption}
                className="w-full gap-2 bg-blue-link hover:bg-blue-link/80 text-white"
                disabled={isSavingCaption}
              >
                {isSavingCaption ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Save Title &amp; Description
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cron Setup */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-card border-border border-green-accent/30">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Zap size={18} className="text-green-accent" />
                Cron Setup (24/7 Automation)
              </CardTitle>
              <CardDescription>
                Set up a free cron service to trigger uploads every hour — no
                need to keep the tab open.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Your Cron Trigger URL
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 block bg-secondary rounded px-3 py-2 text-xs text-green-accent break-all">
                    {cronUrl}
                  </code>
                  <Button
                    data-ocid="cron.primary_button"
                    size="icon"
                    variant="outline"
                    className="shrink-0 border-green-accent/40 text-green-accent hover:bg-green-accent/10"
                    onClick={handleCopyCronUrl}
                    title="Copy URL"
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Setup Steps</Label>
                <ol className="space-y-2.5 text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-accent/20 text-green-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Go to{" "}
                      <a
                        href="https://cron-job.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-link hover:underline inline-flex items-center gap-1"
                      >
                        cron-job.org <ExternalLink size={11} />
                      </a>{" "}
                      and create a free account
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-accent/20 text-green-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>Create a new cronjob and paste the URL above</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-accent/20 text-green-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Set schedule to{" "}
                      <strong className="text-foreground">every 1 hour</strong>{" "}
                      (or your preferred interval)
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-accent/20 text-green-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <span>
                      Set request method to{" "}
                      <strong className="text-foreground">POST</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-accent/20 text-green-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      5
                    </span>
                    <span>Save and enable the cronjob</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-yellow-400/20 text-yellow-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      !
                    </span>
                    <span>
                      <strong className="text-foreground">Important:</strong>{" "}
                      Make sure your OAuth credentials are saved above first —
                      the backend needs them to perform uploads
                    </span>
                  </li>
                </ol>
              </div>

              <div className="flex items-start gap-2.5 bg-green-accent/5 border border-green-accent/20 rounded-lg px-4 py-3 text-sm text-green-accent">
                <Clock size={15} className="shrink-0 mt-0.5" />
                <span>
                  Uploads will start within <strong>30 seconds</strong> of the
                  cron trigger, even if this tab is in the background.
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
