import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { type HistoryEntry, getHistory } from "@/utils/channelStorage";
import { CheckCircle2, Clock, ExternalLink, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

interface UploadHistoryProps {
  channelId: string;
}

export function UploadHistory({ channelId }: UploadHistoryProps) {
  const [history] = useState<HistoryEntry[]>(
    () => getHistory(channelId).entries,
  );

  const sorted = [...history].sort((a, b) => b.uploadedAt - a.uploadedAt);

  const formatDate = (ts: number) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleString();
  };

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-3xl font-bold mb-6 text-foreground"
      >
        Upload History
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Clock size={18} className="text-blue-link" />
              All Uploads ({sorted.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sorted.length === 0 ? (
              <div
                data-ocid="history.empty_state"
                className="text-center py-16 text-muted-foreground"
              >
                <Clock size={48} className="mx-auto mb-3 opacity-20" />
                <p className="text-base font-medium">No uploads yet</p>
                <p className="text-sm mt-1">Uploaded videos will appear here</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-2">
                <div className="space-y-2">
                  {sorted.map((entry, i) => (
                    <div
                      key={entry.id}
                      data-ocid={`history.item.${i + 1}`}
                      className="flex items-center gap-4 p-4 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors"
                    >
                      <div className="shrink-0">
                        {entry.status === "success" ? (
                          <CheckCircle2
                            size={20}
                            className="text-green-accent"
                          />
                        ) : (
                          <XCircle size={20} className="text-destructive" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {entry.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(entry.uploadedAt)}
                        </p>
                        {entry.errorMessage && (
                          <p className="text-xs text-destructive mt-0.5 truncate">
                            {entry.errorMessage}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            entry.status === "success"
                              ? "bg-green-accent/10 text-green-accent border-green-accent/30"
                              : "bg-destructive/10 text-destructive border-destructive/30",
                          )}
                        >
                          {entry.status}
                        </Badge>
                        {entry.youtubeVideoId && (
                          <a
                            href={`https://youtu.be/${entry.youtubeVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-link hover:underline flex items-center gap-1 text-xs"
                          >
                            <ExternalLink size={12} />
                            Watch
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
