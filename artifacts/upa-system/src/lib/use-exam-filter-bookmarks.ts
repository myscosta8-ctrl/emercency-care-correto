import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "upa-exam-filter-bookmarks";

const VALID_EXAM_TYPES     = ["", "laboratorial", "imagem"] as const;
const VALID_EXAM_STATUSES  = ["", "solicitado", "coletado", "laudado"] as const;
const VALID_EXAM_PRIORITIES = ["", "urgente", "rotina", "eletivo"] as const;

export interface ExamFilterBookmark {
  id: string;
  label: string;
  examSearch: string;
  examType: "" | "laboratorial" | "imagem";
  examStatus: "" | "solicitado" | "coletado" | "laudado";
  examPriority: "" | "urgente" | "rotina" | "eletivo";
}

function isValidBookmark(v: unknown): v is ExamFilterBookmark {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.id === "string" && b.id.length > 0 &&
    typeof b.label === "string" && b.label.length > 0 &&
    typeof b.examSearch === "string" &&
    (VALID_EXAM_TYPES as readonly unknown[]).includes(b.examType) &&
    (VALID_EXAM_STATUSES as readonly unknown[]).includes(b.examStatus) &&
    (VALID_EXAM_PRIORITIES as readonly unknown[]).includes(b.examPriority)
  );
}

function loadBookmarks(): ExamFilterBookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidBookmark);
  } catch {
    return [];
  }
}

function persistBookmarks(bookmarks: ExamFilterBookmark[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // storage unavailable — silently ignore
  }
}

export function useExamFilterBookmarks() {
  const [bookmarks, setBookmarks] = useState<ExamFilterBookmark[]>(loadBookmarks);

  useEffect(() => {
    persistBookmarks(bookmarks);
  }, [bookmarks]);

  const saveBookmark = useCallback((
    label: string,
    filter: Omit<ExamFilterBookmark, "id" | "label">,
  ): void => {
    const bookmark: ExamFilterBookmark = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: label.trim(),
      ...filter,
    };
    setBookmarks(prev => [bookmark, ...prev]);
  }, []);

  const deleteBookmark = useCallback((id: string): void => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  }, []);

  const renameBookmark = useCallback((id: string, newLabel: string): void => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, label: trimmed } : b));
  }, []);

  const reorderBookmarks = useCallback((id: string, direction: "up" | "down"): void => {
    setBookmarks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx === -1) return prev;
      const next = direction === "up" ? idx - 1 : idx + 1;
      if (next < 0 || next >= prev.length) return prev;
      const result = [...prev];
      [result[idx], result[next]] = [result[next]!, result[idx]!];
      return result;
    });
  }, []);

  return { bookmarks, saveBookmark, deleteBookmark, renameBookmark, reorderBookmarks };
}
