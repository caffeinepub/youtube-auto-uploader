import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type QueueItemLocal,
  addToQueue,
  clearQueue,
  getChannel,
  getHistory,
  getQueue,
  removeFromQueue,
} from "@/utils/channelStorage";
import { getAccessToken, listDriveFiles } from "@/utils/uploadUtils";
import { List, Loader2, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

interface UploadQueueProps {
  channelId: string;
}

export function UploadQueue({ channelId }: UploadQueueProps) {
  const [queue, setQueue] = useState<QueueItemLocal[]>(
    () => getQueue(channelId).items,
  );
  const [newFileId, setNewFileId] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [isFetchingDrive, setIsFetchingDrive] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const reload = () => setQueue(getQueue(channelId).items);

  const sortedQueue = [...queue].sort((a, b) => a.orderIndex - b.orderIndex);
  const existingIds = new Set(queue.map((q) => q.driveFileId));

  // IDs already successfully uploaded — never re-add these
  const uploadedIds = new Set(
    getHistory(channelId)
      .entries.filter((e) => e.status === "success")
      .map((e) => e.driveFileId),
  );

  const handleAdd = () => {
    if (!newFileId || !newFileName) {
      toast.error("Enter both File ID and File Name");
      return;
    }
    if (uploadedIds.has(newFileId)) {
      toast.warning("This video was already uploaded successfully");
      return;
    }
    const maxOrder = queue.reduce((m, q) => Math.max(m, q.orderIndex), -1);
    addToQueue(channelId, {
      driveFileId: newFileId,
      fileName: newFileName,
      orderIndex: maxOrder + 1,
    });
    setNewFileId("");
    setNewFileName("");
    reload();
    toast.success("Added to queue");
  };

  const handleListDrive = async () => {
    const ch = getChannel(channelId);
    if (!ch?.refreshToken) {
      toast.error("Not authorized. Configure OAuth in Settings.");
      return;
    }
    if (!ch.driveFolderId) {
      toast.error("Set a Drive Folder ID in Settings.");
      return;
    }
    setIsFetchingDrive(true);
    try {
      const token = await getAccessToken(
        ch.clientId,
        ch.clientSecret,
        ch.refreshToken,
      );
      const files = await listDriveFiles(ch.driveFolderId, token);
      setDriveFiles(files);
      const newCount = files.filter(
        (f) => !existingIds.has(f.id) && !uploadedIds.has(f.id),
      ).length;
      toast.success(
        `Found ${files.length} video(s) — ${newCount} new, ${files.length - newCount} already queued/uploaded`,
      );
    } catch (err: any) {
      toast.error("Failed to list Drive files", { description: err.message });
    } finally {
      setIsFetchingDrive(false);
    }
  };

  const handleAddAll = async () => {
    // Skip files already in queue OR already successfully uploaded
    const toAdd = driveFiles.filter(
      (f) => !existingIds.has(f.id) && !uploadedIds.has(f.id),
    );
    if (toAdd.length === 0) {
      toast.info("All files are already in the queue or have been uploaded");
      return;
    }
    setIsAdding(true);
    const maxOrder = queue.reduce((m, q) => Math.max(m, q.orderIndex), -1);
    toAdd.forEach((f, i) =>
      addToQueue(channelId, {
        driveFileId: f.id,
        fileName: f.name,
        orderIndex: maxOrder + 1 + i,
      }),
    );
    reload();
    setIsAdding(false);
    toast.success(`Added ${toAdd.length} file(s) to queue`);
  };

  const handleAddSingle = (file: { id: string; name: string }) => {
    if (uploadedIds.has(file.id)) {
      toast.info("Already uploaded successfully");
      return;
    }
    if (existingIds.has(file.id)) {
      toast.info("Already in queue");
      return;
    }
    const maxOrder = queue.reduce((m, q) => Math.max(m, q.orderIndex), -1);
    addToQueue(channelId, {
      driveFileId: file.id,
      fileName: file.name,
      orderIndex: maxOrder + 1,
    });
    reload();
    toast.success(`Added: ${file.name}`);
  };

  const handleRemove = (driveFileId: string) => {
    removeFromQueue(channelId, driveFileId);
    reload();
  };

  const handleClear = () => {
    if (!confirm("Clear all videos from the queue?")) return;
    clearQueue(channelId);
    reload();
    toast.success("Queue cleared");
  };

  const getFileStatus = (id: string) => {
    if (uploadedIds.has(id)) return "uploaded";
    if (existingIds.has(id)) return "queued";
    return "new";
  };

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-3xl font-bold mb-6 text-foreground"
      >
        Upload Queue
      </motion.h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Queue List */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Upload size={18} className="text-yt-red" />
                Queue ({sortedQueue.length})
              </CardTitle>
              {sortedQueue.length > 0 && (
                <Button
                  data-ocid="queue.delete_button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                >
                  <Trash2 size={14} />
                  Clear All
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {sortedQueue.length === 0 ? (
                <div
                  data-ocid="queue.empty_state"
                  className="text-center py-8 text-muted-foreground"
                >
                  <Upload size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Queue is empty</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-2">
                  <div className="space-y-2">
                    {sortedQueue.map((item, i) => (
                      <div
                        key={item.driveFileId}
                        data-ocid={`queue.item.${i + 1}`}
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 group"
                      >
                        <span className="w-6 h-6 rounded-full bg-yt-red/20 text-yt-red text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.driveFileId}
                          </p>
                        </div>
                        <Button
                          data-ocid={`queue.delete_button.${i + 1}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(item.driveFileId)}
                          className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 w-7 h-7"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Add / Drive panel */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Plus size={16} className="text-green-accent" />
                  Add Video Manually
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="fileId" className="text-xs">
                    Drive File ID
                  </Label>
                  <Input
                    id="fileId"
                    data-ocid="queue.input"
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                    value={newFileId}
                    onChange={(e) => setNewFileId(e.target.value)}
                    className="bg-secondary border-border text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fileName" className="text-xs">
                    File Name
                  </Label>
                  <Input
                    id="fileName"
                    data-ocid="queue.input"
                    placeholder="my-video.mp4"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className="bg-secondary border-border text-sm"
                  />
                </div>
                <Button
                  data-ocid="queue.primary_button"
                  onClick={handleAdd}
                  size="sm"
                  className="w-full bg-yt-red hover:bg-yt-red/80 text-white gap-2"
                >
                  <Plus size={14} />
                  Add to Queue
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <List size={16} className="text-blue-link" />
                  Load from Drive Folder
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  data-ocid="drive.secondary_button"
                  variant="outline"
                  size="sm"
                  onClick={handleListDrive}
                  className="w-full gap-2 border-blue-link text-blue-link hover:bg-blue-link/10"
                  disabled={isFetchingDrive}
                >
                  {isFetchingDrive ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {isFetchingDrive
                    ? "Loading all videos..."
                    : "List Files from Drive"}
                </Button>

                {driveFiles.length > 0 && (
                  <>
                    <Button
                      data-ocid="queue.secondary_button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddAll}
                      className="w-full gap-2"
                      disabled={isAdding}
                    >
                      <Plus size={14} /> Add All New to Queue
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      {driveFiles.length} total •{" "}
                      {
                        driveFiles.filter((f) => getFileStatus(f.id) === "new")
                          .length
                      }{" "}
                      new
                    </p>
                    <ScrollArea className="h-[200px] pr-2">
                      <div className="space-y-1">
                        {driveFiles.map((f) => {
                          const status = getFileStatus(f.id);
                          return (
                            <div
                              key={f.id}
                              className="flex items-center justify-between gap-2 p-2 rounded bg-secondary/50"
                            >
                              <span className="text-xs truncate flex-1">
                                {f.name}
                              </span>
                              {status === "uploaded" ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs h-6 px-2 shrink-0 border-green-accent/30 text-green-accent bg-green-accent/10"
                                >
                                  Uploaded
                                </Badge>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAddSingle(f)}
                                  className="text-xs h-6 px-2 shrink-0"
                                  disabled={status === "queued"}
                                >
                                  {status === "queued" ? "In Queue" : "Add"}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
