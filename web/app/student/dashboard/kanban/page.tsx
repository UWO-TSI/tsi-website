"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  GripVertical,
  Calendar,
  AlertCircle,
  X,
  MessageSquare,
  CheckSquare,
  Square,
} from "lucide-react";

interface KanbanCard {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  position: number;
  column_id: string;
  checklist: { text: string; done: boolean }[] | null;
  assignees: { id: string; display_name: string }[];
  comments: { id: string; user_id: string; content: string; created_at: string; user: { display_name: string } }[];
}

interface KanbanColumn {
  id: string;
  name: string;
  position: number;
  cards: KanbanCard[];
}

interface Board {
  id: string;
  name: string;
}

const priorityColors: Record<string, string> = {
  low: "text-[var(--color-text-muted)] border-[var(--color-text-muted)]",
  medium: "text-[var(--color-brand-yellow)] border-[var(--color-brand-yellow)]",
  high: "text-orange-400 border-orange-400",
  urgent: "text-red-400 border-red-400",
};

export default function KanbanPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [draggedCard, setDraggedCard] = useState<{ cardId: string; fromColumn: string } | null>(null);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newComment, setNewComment] = useState("");

  const fetchBoard = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", user.id)
      .single();

    if (!profile?.team_id) {
      setLoading(false);
      return;
    }

    const { data: boards } = await supabase
      .from("kanban_boards")
      .select("id, name")
      .eq("team_id", profile.team_id)
      .limit(1);

    if (!boards?.length) {
      setLoading(false);
      return;
    }

    setBoard(boards[0]);

    const { data: cols } = await supabase
      .from("kanban_columns")
      .select("id, name, position")
      .eq("board_id", boards[0].id)
      .order("position");

    if (!cols) {
      setLoading(false);
      return;
    }

    const { data: cards } = await supabase
      .from("kanban_cards")
      .select("id, title, description, priority, due_date, position, column_id, checklist, assignees:kanban_card_assignees(id:user_id, user:profiles(display_name))")
      .in("column_id", cols.map((c) => c.id))
      .order("position");

    const columnsWithCards: KanbanColumn[] = cols.map((col) => ({
      ...col,
      cards: (cards ?? [])
        .filter((card) => card.column_id === col.id)
        .map((card) => ({
          ...card,
          priority: card.priority as KanbanCard["priority"],
          checklist: card.checklist as KanbanCard["checklist"],
          assignees: ((card.assignees as unknown) as { id: string; user: { display_name: string } }[])?.map((a) => ({
            id: a.id,
            display_name: a.user?.display_name ?? "Unknown",
          })) ?? [],
          comments: [],
        })),
    }));

    setColumns(columnsWithCards);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const handleDragStart = (cardId: string, fromColumn: string) => {
    setDraggedCard({ cardId, fromColumn });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (toColumnId: string) => {
    if (!draggedCard || draggedCard.fromColumn === toColumnId) {
      setDraggedCard(null);
      return;
    }

    const supabase = createClient();

    setColumns((prev) => {
      const newCols = prev.map((col) => ({ ...col, cards: [...col.cards] }));
      const fromCol = newCols.find((c) => c.id === draggedCard.fromColumn);
      const toCol = newCols.find((c) => c.id === toColumnId);
      if (!fromCol || !toCol) return prev;

      const cardIdx = fromCol.cards.findIndex((c) => c.id === draggedCard.cardId);
      if (cardIdx === -1) return prev;

      const [card] = fromCol.cards.splice(cardIdx, 1);
      card.column_id = toColumnId;
      card.position = toCol.cards.length;
      toCol.cards.push(card);
      return newCols;
    });

    await supabase
      .from("kanban_cards")
      .update({ column_id: toColumnId, position: columns.find((c) => c.id === toColumnId)?.cards.length ?? 0 })
      .eq("id", draggedCard.cardId);

    setDraggedCard(null);
  };

  const addCard = async (columnId: string) => {
    if (!newCardTitle.trim()) return;
    const supabase = createClient();
    const col = columns.find((c) => c.id === columnId);

    const { data } = await supabase
      .from("kanban_cards")
      .insert({
        title: newCardTitle.trim(),
        column_id: columnId,
        position: col?.cards.length ?? 0,
        priority: "medium",
      })
      .select()
      .single();

    if (data) {
      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId
            ? {
                ...col,
                cards: [
                  ...col.cards,
                  { ...data, priority: data.priority as KanbanCard["priority"], checklist: null, assignees: [], comments: [] },
                ],
              }
            : col
        )
      );
    }

    setNewCardTitle("");
    setAddingToColumn(null);
  };

  const openCardDetail = async (card: KanbanCard) => {
    const supabase = createClient();
    const { data: comments } = await supabase
      .from("kanban_card_comments")
      .select("id, user_id, content, created_at, user:profiles(display_name)")
      .eq("card_id", card.id)
      .order("created_at");

    setSelectedCard({
      ...card,
      comments: (comments ?? []).map((c) => ({
        ...c,
        user: c.user as unknown as { display_name: string },
      })),
    });
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedCard) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("kanban_card_comments")
      .insert({ card_id: selectedCard.id, user_id: user.id, content: newComment.trim() })
      .select("id, user_id, content, created_at, user:profiles(display_name)")
      .single();

    if (data) {
      setSelectedCard((prev) =>
        prev
          ? {
              ...prev,
              comments: [
                ...prev.comments,
                { ...data, user: data.user as unknown as { display_name: string } },
              ],
            }
          : null
      );
    }
    setNewComment("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading kanban board...
        </p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle size={32} className="text-[var(--color-text-muted)]" />
        <p className="font-mono text-sm text-[var(--color-text-muted)]">
          No kanban board found. You may not be assigned to a team yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          {board.name}
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          Kanban Board
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div
            key={col.id}
            className="min-w-[300px] w-[300px] shrink-0 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg flex flex-col max-h-[calc(100vh-220px)]"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(col.id)}
          >
            {/* Column Header */}
            <div className="p-3 border-b border-[var(--glass-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-heading font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                  {col.name}
                </h2>
                <span className="text-[0.6rem] font-mono bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)] px-1.5 py-0.5 rounded">
                  {col.cards.length}
                </span>
              </div>
              <button
                onClick={() => setAddingToColumn(col.id)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-brand-blue)] transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {col.cards.map((card) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => handleDragStart(card.id, col.id)}
                  onClick={() => openCardDetail(card)}
                  className="bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md p-3 cursor-pointer hover:border-[var(--color-brand-blue)]/30 hover:shadow-[0_0_8px_rgba(0,47,167,0.1)] transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-[var(--color-text-primary)] font-medium leading-snug">
                      {card.title}
                    </p>
                    <GripVertical
                      size={14}
                      className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className={`text-[0.6rem] font-mono px-1.5 py-0.5 rounded border ${priorityColors[card.priority]}`}
                    >
                      {card.priority.toUpperCase()}
                    </span>

                    {card.due_date && (
                      <span className="flex items-center gap-1 text-[0.6rem] font-mono text-[var(--color-text-muted)]">
                        <Calendar size={10} />
                        {new Date(card.due_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>

                  {card.assignees.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      {card.assignees.slice(0, 3).map((a) => (
                        <div
                          key={a.id}
                          className="w-5 h-5 rounded-full bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/20 flex items-center justify-center"
                          title={a.display_name}
                        >
                          <span className="text-[0.5rem] font-mono text-[var(--color-brand-blue)]">
                            {a.display_name?.[0]?.toUpperCase()}
                          </span>
                        </div>
                      ))}
                      {card.assignees.length > 3 && (
                        <span className="text-[0.5rem] font-mono text-[var(--color-text-muted)]">
                          +{card.assignees.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Add Card Inline */}
              {addingToColumn === col.id && (
                <div className="bg-[var(--color-bg-main)] border border-[var(--color-brand-blue)]/30 rounded-md p-3">
                  <input
                    type="text"
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCard(col.id)}
                    placeholder="Card title..."
                    autoFocus
                    className="w-full bg-transparent text-sm text-[var(--color-text-primary)] font-mono placeholder:text-[var(--color-text-muted)] focus:outline-none"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => addCard(col.id)}
                      className="px-3 py-1 text-xs font-mono bg-[var(--color-brand-blue)] text-white rounded hover:bg-[var(--color-brand-blue)]/80 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setAddingToColumn(null);
                        setNewCardTitle("");
                      }}
                      className="px-3 py-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-[var(--glass-border)] flex items-start justify-between">
              <div>
                <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)]">
                  {selectedCard.title}
                </h2>
                <span
                  className={`inline-block mt-1 text-[0.6rem] font-mono px-1.5 py-0.5 rounded border ${priorityColors[selectedCard.priority]}`}
                >
                  {selectedCard.priority.toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => setSelectedCard(null)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Description */}
              {selectedCard.description && (
                <div>
                  <h3 className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                    Description
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                    {selectedCard.description}
                  </p>
                </div>
              )}

              {/* Due Date */}
              {selectedCard.due_date && (
                <div className="flex items-center gap-2 text-sm font-mono text-[var(--color-text-muted)]">
                  <Calendar size={14} />
                  Due:{" "}
                  {new Date(selectedCard.due_date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              )}

              {/* Assignees */}
              {selectedCard.assignees.length > 0 && (
                <div>
                  <h3 className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                    Assignees
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCard.assignees.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-1.5 bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-2 py-1"
                      >
                        <div className="w-5 h-5 rounded-full bg-[var(--color-brand-blue)]/10 flex items-center justify-center">
                          <span className="text-[0.5rem] font-mono text-[var(--color-brand-blue)]">
                            {a.display_name?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                          {a.display_name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checklist */}
              {selectedCard.checklist && selectedCard.checklist.length > 0 && (
                <div>
                  <h3 className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                    Checklist
                  </h3>
                  <div className="space-y-1">
                    {selectedCard.checklist.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {item.done ? (
                          <CheckSquare size={14} className="text-[var(--color-accent-cyan)]" />
                        ) : (
                          <Square size={14} className="text-[var(--color-text-muted)]" />
                        )}
                        <span
                          className={
                            item.done
                              ? "text-[var(--color-text-muted)] line-through"
                              : "text-[var(--color-text-secondary)]"
                          }
                        >
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div>
                <h3 className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                  <MessageSquare size={12} />
                  Comments ({selectedCard.comments.length})
                </h3>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {selectedCard.comments.map((c) => (
                    <div key={c.id} className="bg-[var(--color-bg-main)] rounded-md p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-[var(--color-brand-blue)]">
                          {c.user?.display_name ?? "Unknown"}
                        </span>
                        <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)]">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)]">{c.content}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addComment()}
                    placeholder="Add a comment..."
                    className="flex-1 bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
                  />
                  <button
                    onClick={addComment}
                    className="px-3 py-2 text-xs font-mono bg-[var(--color-brand-blue)] text-white rounded-md hover:bg-[var(--color-brand-blue)]/80 transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
