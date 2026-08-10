"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface BoardSummary {
  id: string;
  title: string;
  sortOrder: number;
}

interface BoardTabsProps {
  boards: BoardSummary[];
  selectedBoardId: string | null;
  onSelect: (boardId: string | null) => void;
  editable?: boolean;
  onAdd?: (title: string) => void;
  onRename?: (boardId: string, title: string) => void;
  onRemove?: (boardId: string) => void;
  onReorder?: (boardIds: string[]) => void;
  onLinkPanels?: (boardId: string) => void;
}

export function BoardTabs({
  boards,
  selectedBoardId,
  onSelect,
  editable = false,
  onAdd,
  onRename,
  onRemove,
  onReorder,
  onLinkPanels,
}: BoardTabsProps) {
  const [items, setItems] = useState(boards);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    setItems(boards);
  }, [boards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((b) => b.id === active.id);
    const newIndex = items.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    onReorder?.(reordered.map((b) => b.id));
  }

  function handleAdd() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onAdd?.(trimmed);
    setNewTitle("");
    setAdding(false);
  }

  if (boards.length === 0 && !editable) return null;

  const tabContent = (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
      <button
        type="button"
        className={cn(
          "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          selectedBoardId === null
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        onClick={() => onSelect(null)}
      >
        Todos
      </button>

      {editable ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((b) => b.id)}
            strategy={horizontalListSortingStrategy}
          >
            {items.map((board) => (
              <SortableBoardTab
                key={board.id}
                board={board}
                isSelected={selectedBoardId === board.id}
                onSelect={() => onSelect(board.id)}
                editable
                onRename={onRename}
                onRemove={onRemove}
                onLinkPanels={onLinkPanels}
              />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        items.map((board) => (
          <BoardTab
            key={board.id}
            board={board}
            isSelected={selectedBoardId === board.id}
            onSelect={() => onSelect(board.id)}
          />
        ))
      )}

      {editable && !adding && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1 text-muted-foreground"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-3.5" />
          Quadro
        </Button>
      )}

      {adding && (
        <form
          className="flex shrink-0 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nome do quadro"
            className="h-7 w-36 text-sm"
            autoFocus
            onBlur={() => {
              if (!newTitle.trim()) setAdding(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAdding(false);
                setNewTitle("");
              }
            }}
          />
        </form>
      )}
    </div>
  );

  return <div className="border-b pb-1">{tabContent}</div>;
}

function BoardTab({
  board,
  isSelected,
  onSelect,
}: {
  board: BoardSummary;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      onClick={onSelect}
    >
      {board.title}
    </button>
  );
}

function SortableBoardTab({
  board,
  isSelected,
  onSelect,
  editable,
  onRename,
  onRemove,
  onLinkPanels,
}: {
  board: BoardSummary;
  isSelected: boolean;
  onSelect: () => void;
  editable?: boolean;
  onRename?: (boardId: string, title: string) => void;
  onRemove?: (boardId: string) => void;
  onLinkPanels?: (boardId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: board.id });

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(board.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function handleRenameSubmit() {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== board.title) {
      onRename?.(board.id, trimmed);
    }
    setEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex shrink-0 items-center gap-0.5 rounded-md transition-colors",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span
        className="cursor-grab p-1 opacity-0 group-hover:opacity-100"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3" />
      </span>

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRenameSubmit();
          }}
          className="flex items-center"
        >
          <Input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="h-6 w-28 text-sm"
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditTitle(board.title);
                setEditing(false);
              }
            }}
          />
        </form>
      ) : (
        <button
          type="button"
          className="px-2 py-1.5 text-sm font-medium"
          onClick={onSelect}
        >
          {board.title}
        </button>
      )}

      {editable && !editing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-black/10"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onLinkPanels?.(board.id)}>
              <Link2 className="mr-2 size-3.5" />
              Vincular painéis
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditTitle(board.title);
                setEditing(true);
              }}
            >
              <Pencil className="mr-2 size-3.5" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onRemove?.(board.id)}
            >
              <Trash2 className="mr-2 size-3.5" />
              Excluir quadro
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
