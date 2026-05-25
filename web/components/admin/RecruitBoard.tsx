"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Check, Clock, X } from "lucide-react";
import {
  APPLICATION_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  isTerminalStatus,
  nextPipelineStatus,
  type Application,
  type ApplicationStatus,
  type Position,
} from "@/lib/recruitment";

interface RecruitBoardProps {
  applications: Application[];
  positions: Position[];
  onStatusChange: (id: string, status: ApplicationStatus | null) => void;
}

// 6-column kanban grouped by effective verdict (draft || released).
// Drag a card to another column to set its draft to that column's status.
// The mini buttons on hover remain for keyboard-friendly action.
export default function RecruitBoard({
  applications,
  positions,
  onStatusChange,
}: RecruitBoardProps) {
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // 4px activation distance prevents accidental drags when clicking the
  // mini verdict buttons inside the card.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  const filtered = positionFilter
    ? applications.filter((a) => a.position_id === positionFilter)
    : applications;

  const grouped = useMemo(() => {
    const map: Record<ApplicationStatus, Application[]> = {
      screening: [],
      interview_invite: [],
      final_review: [],
      accepted: [],
      waitlist: [],
      rejected: [],
    };
    for (const a of filtered) {
      const s = (a.draft_status ?? a.status) as ApplicationStatus;
      if (map[s]) map[s].push(a);
    }
    return map;
  }, [filtered]);

  const draggingApp = useMemo(
    () => filtered.find((a) => a.id === draggingId) ?? null,
    [filtered, draggingId]
  );

  function handleDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const target = overId as ApplicationStatus;
    if (!APPLICATION_STATUSES.includes(target)) return;
    const app = filtered.find((a) => a.id === id);
    if (!app) return;
    const currentEffective = (app.draft_status ?? app.status) as ApplicationStatus;
    if (currentEffective === target) return;
    onStatusChange(id, target);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      {/* Position filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <PositionChip
          label="All roles"
          active={positionFilter === ""}
          onClick={() => setPositionFilter("")}
          count={applications.length}
        />
        {positions.map((p) => (
          <PositionChip
            key={p.id}
            label={p.title}
            active={positionFilter === p.id}
            onClick={() => setPositionFilter(p.id)}
            count={applications.filter((a) => a.position_id === p.id).length}
          />
        ))}
        <span className="ml-auto text-[10px] font-mono text-[#6B7280] tabular-nums">
          drag cards between columns to change status
        </span>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {APPLICATION_STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            apps={grouped[status]}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>

      {/* Drag overlay — what follows the cursor */}
      <DragOverlay dropAnimation={null}>
        {draggingApp ? (
          <div
            className="rounded-lg p-2.5 cursor-grabbing"
            style={{
              background: "rgba(15,15,16,0.95)",
              border: "1px solid rgba(29,155,240,0.5)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
              minWidth: 180,
            }}
          >
            <p className="text-xs font-medium text-[#F1FFFF] truncate leading-tight">
              {draggingApp.full_name}
            </p>
            <p className="text-[10px] font-mono text-[#9CA3AF] truncate">
              {draggingApp.position?.title}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function PositionChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition"
      style={{
        background: active ? "rgba(29,155,240,0.15)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? "rgba(29,155,240,0.4)" : "rgba(255,255,255,0.08)"}`,
        color: active ? "#1D9BF0" : "#9CA3AF",
        fontFamily: "var(--font-highlight)",
      }}
    >
      {label}
      <span className="text-[10px] opacity-70 tabular-nums">{count}</span>
    </button>
  );
}

function BoardColumn({
  status,
  apps,
  onStatusChange,
}: {
  status: ApplicationStatus;
  apps: Application[];
  onStatusChange: (id: string, status: ApplicationStatus | null) => void;
}) {
  const color = STATUS_COLORS[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className="rounded-xl p-3 min-h-[220px] transition-colors"
      style={{
        background: isOver ? `${color}1c` : `${color}08`,
        border: `1px ${isOver ? "solid" : "solid"} ${isOver ? color : `${color}28`}`,
        boxShadow: isOver ? `inset 0 0 0 1px ${color}` : undefined,
      }}
    >
      <header
        className="flex items-center justify-between mb-3 pb-2 border-b"
        style={{ borderColor: `${color}25` }}
      >
        <span
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color }}
        >
          {STATUS_LABELS[status]}
        </span>
        <span
          className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded"
          style={{ background: `${color}1a`, color }}
        >
          {apps.length}
        </span>
      </header>

      <div className="space-y-2">
        {apps.length === 0 ? (
          <p className="text-[10px] text-[#3f3f46] text-center py-6 font-mono">
            {isOver ? "drop here" : "empty"}
          </p>
        ) : (
          apps.map((app) => (
            <BoardCard
              key={app.id}
              app={app}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </section>
  );
}

function BoardCard({
  app,
  onStatusChange,
}: {
  app: Application;
  onStatusChange: (id: string, status: ApplicationStatus | null) => void;
}) {
  const effective = (app.draft_status ?? app.status) as ApplicationStatus;
  const advanceTarget = nextPipelineStatus(effective);
  const isDraft = app.draft_status && app.draft_status !== app.status;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: app.id,
  });

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: isDragging ? 0.3 : 1, y: 0 }}
      {...attributes}
      {...listeners}
      className="rounded-lg p-2.5 group cursor-grab active:cursor-grabbing select-none"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: isDraft
          ? "1px dashed rgba(255,209,102,0.45)"
          : "1px solid rgba(255,255,255,0.06)",
        touchAction: "none",
      }}
    >
      <div className="mb-1.5">
        <p className="text-xs font-medium text-[#F1FFFF] truncate leading-tight">
          {app.full_name}
        </p>
        <p className="text-[10px] font-mono text-[#6B7280] truncate">
          {app.position?.title}
        </p>
      </div>

      {/* Mini verdict row — hidden by default, shown on hover.
          Always render all 3 so terminal cards can be reopened. */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <MiniVerdictBtn
          icon={<Check className="w-2.5 h-2.5" />}
          color="#22C55E"
          title={
            isTerminalStatus(effective)
              ? "Reopen → Screening"
              : advanceTarget
                ? `Advance → ${STATUS_LABELS[advanceTarget]}`
                : "Advance"
          }
          onClick={() => {
            if (isTerminalStatus(effective)) {
              onStatusChange(app.id, "screening");
            } else if (advanceTarget) {
              onStatusChange(app.id, advanceTarget);
            }
          }}
        />
        <MiniVerdictBtn
          icon={<Clock className="w-2.5 h-2.5" />}
          color="#F97316"
          title={effective === "waitlist" ? "Revert waitlist" : "Move to waitlist"}
          onClick={() =>
            onStatusChange(
              app.id,
              effective === "waitlist"
                ? isDraft
                  ? null
                  : "screening"
                : "waitlist"
            )
          }
        />
        <MiniVerdictBtn
          icon={<X className="w-2.5 h-2.5" />}
          color="#EF4444"
          title={effective === "rejected" ? "Revert reject" : "Reject"}
          onClick={() =>
            onStatusChange(
              app.id,
              effective === "rejected"
                ? isDraft
                  ? null
                  : "screening"
                : "rejected"
            )
          }
        />
        {isDraft && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onStatusChange(app.id, null)}
            className="ml-auto text-[9px] font-mono text-[#FFD166] hover:text-[#F1FFFF] transition"
            title="Discard pending verdict"
          >
            undo
          </button>
        )}
      </div>
    </motion.div>
  );
}

function MiniVerdictBtn({
  icon,
  color,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  onClick: () => void;
}) {
  // stopPropagation on pointerdown so the drag listener on the parent card
  // doesn't fire when the user clicks a button.
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      title={title}
      className="p-1 rounded transition"
      style={{ color, background: `${color}1a` }}
    >
      {icon}
    </button>
  );
}
