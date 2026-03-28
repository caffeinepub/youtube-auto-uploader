import {
  type Channel,
  createChannel,
  deleteChannel,
  getChannels,
} from "@/utils/channelStorage";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const AVATAR_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-yellow-500",
];

interface ChannelTabBarProps {
  activeChannelId: string;
  onSwitch: (channelId: string) => void;
  onChannelsChange: () => void;
}

export function ChannelTabBar({
  activeChannelId,
  onSwitch,
  onChannelsChange,
}: ChannelTabBarProps) {
  const [channels, setChannels] = useState<Channel[]>(getChannels);
  const [addingName, setAddingName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Refresh channel list whenever the active channel changes (e.g. after delete/create)
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeChannelId intentionally triggers storage re-read
  useEffect(() => {
    setChannels(getChannels());
  }, [activeChannelId]);

  useEffect(() => {
    if (showAdd) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showAdd]);

  const handleAdd = () => {
    const name = addingName.trim() || `Channel ${channels.length + 1}`;
    const ch = createChannel(name);
    const updated = getChannels();
    setChannels(updated);
    setAddingName("");
    setShowAdd(false);
    onSwitch(ch.id);
    onChannelsChange();
    toast.success(`"${name}" channel created`);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this channel and all its data?")) return;
    deleteChannel(id);
    const remaining = getChannels();
    setChannels(remaining);
    if (id === activeChannelId) {
      const next = remaining[0]?.id ?? "";
      onSwitch(next);
    }
    onChannelsChange();
    toast.success("Channel deleted");
  };

  return (
    <div
      className="w-full bg-zinc-950 border-b border-zinc-800 flex items-center shrink-0"
      style={{ height: 48 }}
    >
      {/* Scrollable tabs */}
      <div
        className="flex-1 flex items-center overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {channels.map((ch, idx) => {
          const isActive = ch.id === activeChannelId;
          const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
          const initial = ch.name.charAt(0).toUpperCase();
          return (
            <button
              type="button"
              key={ch.id}
              data-ocid={`channel.tab.${idx + 1}`}
              onClick={() => onSwitch(ch.id)}
              className={`
                group relative flex items-center gap-2 px-4 py-2 h-full text-sm whitespace-nowrap shrink-0 transition-colors
                ${
                  isActive
                    ? "bg-zinc-800 border-b-2 border-red-500 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border-b-2 border-transparent"
                }
              `}
            >
              <span
                className={`w-7 h-7 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}
              >
                {initial}
              </span>
              <span className="max-w-[120px] truncate">{ch.name}</span>
              {channels.length > 1 && (
                <button
                  type="button"
                  aria-label={`Delete ${ch.name}`}
                  onClick={(e) => handleDelete(e, ch.id)}
                  data-ocid={`channel.delete_button.${idx + 1}`}
                  className="ml-1 opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full flex items-center justify-center hover:bg-zinc-600 text-zinc-400 hover:text-white transition-opacity"
                >
                  <X size={10} />
                </button>
              )}
            </button>
          );
        })}
      </div>

      {/* Add channel button / inline input */}
      <div className="flex items-center px-2 shrink-0">
        {showAdd ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={addingName}
              onChange={(e) => setAddingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setShowAdd(false);
                  setAddingName("");
                }
              }}
              placeholder="Channel name"
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white w-36 outline-none focus:border-red-500"
              data-ocid="channel.input"
            />
            <button
              type="button"
              onClick={handleAdd}
              data-ocid="channel.primary_button"
              className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setAddingName("");
              }}
              className="text-zinc-400 hover:text-white px-1"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-ocid="channel.open_modal_button"
            onClick={() => setShowAdd(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Add channel"
          >
            <Plus size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
