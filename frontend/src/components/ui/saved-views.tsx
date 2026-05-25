"use client";

import { useState } from "react";
import { Save, Eye, MoreHorizontal, Trash2, Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ViewConfig {
  id: string;
  name: string;
  filters: Record<string, any>;
  timestamp: number;
}

interface SavedViewsProps {
  views: ViewConfig[];
  activeViewId?: string;
  onSelect: (view: ViewConfig) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  className?: string;
}

export function SavedViews({ views, activeViewId, onSelect, onSave, onDelete, onRename, className }: SavedViewsProps) {
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleSave = () => {
    if (!newName.trim()) return;
    onSave(newName.trim());
    setNewName("");
    setSaving(false);
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    onRename(id, editName.trim());
    setEditingId(null);
    setEditName("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          Saved Views
        </div>
        {!saving ? (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setSaving(true)}>
            <Save className="h-3.5 w-3.5" />
            Save current
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              className="h-7 w-28 rounded-md border bg-background px-2 text-xs outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              placeholder="View name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setSaving(false); setNewName(""); } }}
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave}><Check className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSaving(false); setNewName(""); }}><X className="h-3.5 w-3.5" /></Button>
          </div>
        )}
      </div>

      {views.length > 0 && (
        <div className="space-y-1">
          {views.map((view) => (
            <div
              key={view.id}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent",
                activeViewId === view.id && "bg-accent font-medium"
              )}
              onClick={() => onSelect(view)}
            >
              <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {editingId === view.id ? (
                <input
                  className="h-6 flex-1 rounded border bg-background px-1.5 text-xs outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename(view.id); if (e.key === "Escape") setEditingId(null); }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 truncate text-xs">{view.name}</span>
              )}
              <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); setEditingId(view.id); setEditName(view.name); }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(view.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
