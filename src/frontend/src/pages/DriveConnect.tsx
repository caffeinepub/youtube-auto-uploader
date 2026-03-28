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
import { ScrollArea } from "@/components/ui/scroll-area";
import { getChannel, updateChannel } from "@/utils/channelStorage";
import { getAccessToken, listDriveFiles } from "@/utils/uploadUtils";
import type { DriveFile } from "@/utils/uploadUtils";
import {
  CheckCircle2,
  Film,
  HardDrive,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

interface DriveConnectProps {
  channelId: string;
}

export function DriveConnect({ channelId }: DriveConnectProps) {
  const channel = getChannel(channelId);
  const [folderId, setFolderId] = useState(channel?.driveFolderId ?? "");
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleTest = async () => {
    const ch = getChannel(channelId);
    if (!ch?.refreshToken) {
      toast.error("OAuth not configured. Go to Settings first.");
      return;
    }
    if (!folderId) {
      toast.error("Enter a Folder ID");
      return;
    }
    setIsTesting(true);
    try {
      const token = await getAccessToken(
        ch.clientId,
        ch.clientSecret,
        ch.refreshToken,
      );
      const result = await listDriveFiles(folderId, token);
      setFiles(result);
      toast.success(`Found ${result.length} video(s)`);
    } catch (err: any) {
      toast.error("Connection test failed", { description: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      updateChannel(channelId, { driveFolderId: folderId });
      toast.success("Drive folder saved");
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-3xl font-bold mb-6 text-foreground"
      >
        Google Drive Connect
      </motion.h1>

      <div className="max-w-2xl space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <HardDrive size={18} className="text-blue-link" />
                Drive Folder Setup
              </CardTitle>
              <CardDescription>
                Set the Google Drive folder that contains your videos for
                automatic uploading. All videos (500+) will be loaded.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="driveFolderId">Google Drive Folder ID</Label>
                <Input
                  id="driveFolderId"
                  data-ocid="drive.input"
                  placeholder="Paste folder ID from Drive URL"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="bg-secondary border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Find it in your Drive URL: drive.google.com/drive/folders/
                  <strong>FOLDER_ID</strong>
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  data-ocid="drive.secondary_button"
                  variant="outline"
                  onClick={handleTest}
                  className="gap-2 border-blue-link text-blue-link hover:bg-blue-link/10"
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  {isTesting ? "Loading all pages..." : "Test Connection"}
                </Button>
                <Button
                  data-ocid="drive.primary_button"
                  onClick={handleSave}
                  className="gap-2 bg-yt-red hover:bg-yt-red/80 text-white"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Save Folder
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            data-ocid="drive.panel"
          >
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Film size={16} className="text-green-accent" />
                  Folder Contents ({files.length} videos)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-2">
                  <div className="space-y-1.5">
                    {files.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-secondary/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Film
                            size={14}
                            className="text-muted-foreground shrink-0"
                          />
                          <span className="text-sm truncate">{f.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {f.size
                            ? `${(Number(f.size) / 1024 / 1024).toFixed(1)} MB`
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </main>
  );
}
