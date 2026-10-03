"use client";

import { useState, useEffect, useCallback } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  GripVertical,
  Calendar,
  SquareKanban,
  MessageSquare,
  CheckSquare,
  Square,
} from "lucide-react";
import { Badge, Banner, Button, Empty, ErrorNote, IconButton, Loading, Sheet, type BadgeTone } from "@/components/gui";
import { addComment, loadBoard, loadComments, moveCard, type KanbanCard, type KanbanColumn, type KanbanComment } from "@/lib/portal/kanban";

interface Board {
  id: string;
  name: string;
}

/** Priority as a tag, quiet to loud: low, medium, high, urgent. */
const PRIORITY: Record<string, { tone: BadgeTone; label: string }> = {
  low: { tone: "neutral", label: "Low" },
  medium: { tone: "info", label: "Medium" },
  high: { tone: "warn", label: "High" },
  urgent: { tone: "danger", label: "Urgent" },
};

const formatDay = (iso: string, weekday = false) =>
  new Date(iso).toLocaleDateString("en-CA", {
    ...(weekday ? { weekday: "short" as const } : {}),
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  });

const PAGE_PAD = { padding: "24px 20px 48px" };

export default function KanbanPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadState, setLoadState] = useState<"ready" | "signed-out" | "error">("ready");
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [comments, setComments] = useState<KanbanComment[] | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<KanbanCard | null>(null);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newComment, setNewComment] = useState("");

  // Mouse drags after a small move; touch after a short press, so a quick swipe still scrolls the column.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const fetchBoard = useCallback(async () => {
    try {
      const r = await loadBoard(createClient());
      if (!r) return setLoadState("signed-out");
      setBoard(r.board);
      setColumns(r.columns);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const handleDragEnd = async (e: DragEndEvent) => {
    setDragging(null);
    const to = e.over ? String(e.over.id) : null;
    const moved = to ? moveCard(columns, String(e.active.id), to) : null;
    if (!to || !moved) return;
    const before = columns;
    setColumns(moved.columns);
    setError(null);
    // A move the board's policy refuses updates no row (no error), so the row must come back.
    const { data: updated, error: moveError } = await createClient()
      .from("kanban_cards")
      .update({ column_id: to, position: moved.position })
      .eq("id", String(e.active.id))
      .select("id");
    if (moveError || !updated?.length) {
      setColumns(before);
      setError("That card didn’t move. Try again.");
    }
  };

  const addCard = async (columnId: string) => {
    if (!newCardTitle.trim()) return;
    const col = columns.find((c) => c.id === columnId);
    setError(null);
    const { data, error: addError } = await createClient()
      .from("kanban_cards")
      .insert({
        title: newCardTitle.trim(),
        column_id: columnId,
        position: col?.cards.length ?? 0,
        priority: "medium",
      })
      .select("id, title, description, priority, due_date, position, column_id")
      .single();

    if (addError || !data) {
      setError("That card wasn’t added. Try again.");
      return;
    }
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, cards: [...c.cards, { ...data, checklist: [], assignees: [] } as KanbanCard] } : c))
    );
    setNewCardTitle("");
    setAddingToColumn(null);
  };

  const openCardDetail = async (card: KanbanCard) => {
    setSelectedCard(card);
    setComments(null);
    setCommentError(null);
    try {
      setComments(await loadComments(createClient(), card.id));
    } catch {
      setComments([]);
      setCommentError("The comments didn’t load.");
    }
  };

  const sendComment = async () => {
    if (!newComment.trim() || !selectedCard) return;
    setCommentError(null);
    try {
      const comment = await addComment(createClient(), selectedCard.id, newComment.trim());
      setComments((prev) => [...(prev ?? []), comment]);
      setNewComment("");
    } catch {
      setCommentError("Your comment didn’t send. Try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto" style={PAGE_PAD}>
        <Loading label="Loading your team’s board…" />
      </div>
    );
  }

  if (loadState !== "ready") {
    return (
      <div className="flex-1 overflow-y-auto" style={PAGE_PAD}>
        {loadState === "signed-out"
          ? <Empty icon={<SquareKanban size={32} />} title="Sign in to see your board">Your team’s board shows up here once you’re signed in.</Empty>
          : <ErrorNote onRetry={() => { setLoading(true); fetchBoard(); }}>Your team’s board didn’t load.</ErrorNote>}
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex-1 overflow-y-auto" style={PAGE_PAD}>
        <Empty icon={<SquareKanban size={32} />} title="No board yet">
          You may not be on a team yet. Once your team has a board, it shows up here.
        </Empty>
      </div>
    );
  }

  const selectedPriority = selectedCard ? PRIORITY[selectedCard.priority] : undefined;

  return (
    <div className="flex-1 overflow-y-auto" style={PAGE_PAD}>
      <Banner title={board.name} icon={<SquareKanban size={26} />} tone="sage">
        Your team’s board. Drag a card to another column to move it along.
      </Banner>

      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      <DndContext
        sensors={sensors}
        accessibility={{ screenReaderInstructions: { draggable: "Press Enter to open this card. To move it, drag it to another column; on a touch screen, press and hold it first." } }}
        onDragStart={(e) => setDragging(columns.flatMap((c) => c.cards).find((k) => k.id === String(e.active.id)) ?? null)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
          {columns.map((col) => (
            <BoardColumn key={col.id} id={col.id}>
              {/* Column Header */}
              <div
                className="flex items-center justify-between gap-2"
                style={{ padding: "8px 8px 8px 16px", borderBottom: "2px dashed var(--gui-paper-edge)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-sm truncate" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                    {col.name}
                  </h2>
                  <Badge>{col.cards.length}</Badge>
                </div>
                <IconButton label={`Add a card to ${col.name}`} size="sm" onClick={() => setAddingToColumn(col.id)}>
                  <Plus size={18} aria-hidden />
                </IconButton>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {col.cards.map((card) => (
                  <BoardCard key={card.id} card={card} onOpen={() => openCardDetail(card)} />
                ))}

                {/* Add Card Inline */}
                {addingToColumn === col.id && (
                  <div
                    style={{
                      background: "var(--gui-paper-hi)",
                      borderRadius: 14,
                      padding: 10,
                      boxShadow: "inset 0 0 0 2px var(--gui-sage)",
                    }}
                  >
                    <input
                      type="text"
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCard(col.id)}
                      placeholder="Card title…"
                      aria-label={`New card in ${col.name}`}
                      autoFocus
                      className="w-full bg-transparent text-sm placeholder:text-[var(--gui-muted)]"
                      style={{ color: "var(--gui-ink-strong)", fontWeight: 700, padding: "4px 6px" }}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Button size="sm" onClick={() => addCard(col.id)}>
                        Add card
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => {
                          setAddingToColumn(null);
                          setNewCardTitle("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </BoardColumn>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{dragging ? <CardFace card={dragging} lifted /> : null}</DragOverlay>
      </DndContext>

      {/* Card Detail Sheet */}
      <Sheet
        open={selectedCard !== null}
        onClose={() => setSelectedCard(null)}
        title={selectedCard?.title ?? ""}
        eyebrow={board.name}
        icon={<SquareKanban size={22} />}
        size="md"
        footer={selectedCard && (
          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendComment()}
              placeholder="Add a comment…"
              aria-label="Add a comment"
              className="flex-1 min-w-0 text-sm border-2 border-[var(--gui-paper-line)] focus:border-[var(--gui-sage)] placeholder:text-[var(--gui-muted)] transition-colors"
              style={{
                height: 40,
                padding: "0 16px",
                borderRadius: "var(--gui-r-pill)",
                background: "var(--gui-paper-hi)",
                color: "var(--gui-ink)",
                fontWeight: 600,
              }}
            />
            <Button size="sm" onClick={sendComment}>
              Send
            </Button>
          </div>
        )}
      >
        {selectedCard && (
          <div className="space-y-5">
            {/* Priority + due date */}
            {(selectedPriority || selectedCard.due_date) && (
              <div className="flex flex-wrap items-center gap-3">
                {selectedPriority && <Badge tone={selectedPriority.tone}>{selectedPriority.label} priority</Badge>}
                {selectedCard.due_date && (
                  <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--gui-ink-2)", fontWeight: 700 }}>
                    <Calendar size={14} aria-hidden />
                    Due {formatDay(selectedCard.due_date, true)}
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            {selectedCard.description && (
              <section>
                <h3 className="text-sm mb-1.5" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                  Description
                </h3>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--gui-ink)" }}>
                  {selectedCard.description}
                </p>
              </section>
            )}

            {/* Assignees */}
            {selectedCard.assignees.length > 0 && (
              <section>
                <h3 className="text-sm mb-2" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                  Assignees
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCard.assignees.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-1.5"
                      style={{
                        background: "var(--gui-paper-warm)",
                        borderRadius: "var(--gui-r-pill)",
                        padding: "3px 12px 3px 3px",
                        boxShadow: "inset 0 0 0 1.5px var(--gui-paper-edge)",
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: "var(--gui-sage-soft)" }}
                      >
                        <span className="text-xs" style={{ color: "var(--gui-sage-deep)", fontWeight: 800 }}>
                          {a.display_name?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm" style={{ color: "var(--gui-ink)", fontWeight: 700 }}>
                        {a.display_name}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Checklist */}
            {selectedCard.checklist.length > 0 && (
              <section>
                <h3 className="text-sm mb-2" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                  Checklist
                </h3>
                <ul className="space-y-1.5">
                  {selectedCard.checklist.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      {item.done ? (
                        <CheckSquare size={16} className="shrink-0" style={{ color: "var(--gui-teal-ink)" }} aria-label="Done" />
                      ) : (
                        <Square size={16} className="shrink-0" style={{ color: "var(--gui-muted)" }} aria-label="Not done" />
                      )}
                      <span
                        className={item.done ? "line-through" : undefined}
                        style={{ color: item.done ? "var(--gui-muted)" : "var(--gui-ink)" }}
                      >
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Comments */}
            <section>
              <h3 className="text-sm mb-2 flex items-center gap-1.5" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                <MessageSquare size={14} aria-hidden />
                Comments{comments ? ` (${comments.length})` : ""}
              </h3>
              {commentError && <ErrorNote className="mb-2.5">{commentError}</ErrorNote>}
              {comments === null ? (
                <Loading label="Getting the comments…" />
              ) : comments.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--gui-muted)" }}>
                  No comments yet. Add the first one below.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      style={{ background: "var(--gui-paper-warm)", borderRadius: 14, padding: "10px 12px" }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs" style={{ color: "var(--gui-sage)", fontWeight: 800 }}>
                          {c.user?.display_name ?? "Unknown"}
                        </span>
                        <span className="text-xs" style={{ color: "var(--gui-muted)" }}>
                          {formatDay(c.created_at)}
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: "var(--gui-ink)" }}>{c.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** A column cards drop into (the whole column is the target). */
function BoardColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="min-w-[300px] w-[300px] shrink-0 flex flex-col max-h-[calc(100dvh-240px)] transition-shadow"
      style={{
        background: "var(--gui-paper-warm)",
        borderRadius: "var(--gui-r-card)",
        boxShadow: isOver
          ? "var(--gui-shadow-sm), inset 0 0 0 2.5px var(--gui-sage)"
          : "var(--gui-shadow-sm), inset 0 0 0 1.5px var(--gui-paper-edge)",
      }}
    >
      {children}
    </div>
  );
}

/** A card on the board: tap or Enter opens it; drag it (a press-and-hold on a touch screen) to another column. */
function BoardCard({ card, onOpen }: { card: KanbanCard; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      className="group cursor-pointer transition-transform hover:-translate-y-0.5"
      style={{ touchAction: "manipulation", opacity: isDragging ? 0.55 : 1 }}
    >
      <CardFace card={card} />
    </div>
  );
}

function CardFace({ card, lifted }: { card: KanbanCard; lifted?: boolean }) {
  const priority = PRIORITY[card.priority];
  return (
    <div
      style={{
        background: "var(--gui-paper-hi)",
        borderRadius: 14,
        padding: 12,
        boxShadow: lifted ? "var(--gui-shadow-md), inset 0 0 0 1.5px var(--gui-paper-edge)" : "var(--gui-shadow-sm), inset 0 0 0 1.5px var(--gui-paper-edge)",
        cursor: lifted ? "grabbing" : undefined,
        width: lifted ? 280 : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug" style={{ color: "var(--gui-ink-strong)", fontWeight: 700 }}>
          {card.title}
        </p>
        <GripVertical
          size={14}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
          style={{ color: "var(--gui-muted)" }}
          aria-hidden
        />
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {priority && <Badge tone={priority.tone}>{priority.label}</Badge>}

        {card.due_date && (
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>
            <Calendar size={12} aria-hidden />
            {formatDay(card.due_date)}
          </span>
        )}

        {card.checklist.length > 0 && (
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>
            <CheckSquare size={12} aria-hidden />
            {card.checklist.filter((i) => i.done).length}/{card.checklist.length}
          </span>
        )}
      </div>

      {card.assignees.length > 0 && (
        <div className="flex items-center gap-1 mt-2">
          {card.assignees.slice(0, 3).map((a) => (
            <div
              key={a.id}
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "var(--gui-sage-soft)", boxShadow: "0 0 0 2px var(--gui-paper-hi)" }}
              title={a.display_name}
            >
              <span className="text-xs" style={{ color: "var(--gui-sage-deep)", fontWeight: 800 }}>
                {a.display_name?.[0]?.toUpperCase()}
              </span>
            </div>
          ))}
          {card.assignees.length > 3 && (
            <span className="text-xs" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>
              +{card.assignees.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
