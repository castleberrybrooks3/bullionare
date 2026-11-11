import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./StockNotesModal.css";

const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });

const sortEntries = (entries) =>
  [...entries].sort((a, b) =>
    a.created_at === b.created_at
      ? a.id.localeCompare(b.id)
      : a.created_at.localeCompare(b.created_at)
  );

// Each addition has an original creation date. Editing it changes its activity
// date, but never overwrites the original creation date.
const entryLastActivity = (entry) =>
  entry.edited_at && entry.edited_at > entry.created_at
    ? entry.edited_at
    : entry.created_at;

const noteLastActivity = (note) =>
  note.entries.reduce(
    (latest, entry) => {
      const timestamp = entryLastActivity(entry);
      return timestamp > latest ? timestamp : latest;
    },
    note.created_at
  );

export default function StockNotesModal({ isOpen, ticker, onClose, onNotesChanged }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // mode: "new", "append", or "edit". Editing targets one specific dated entry.
  const [composer, setComposer] = useState(null);
  const [draft, setDraft] = useState("");
  const currentRequest = useRef(0);
  const textareaRef = useRef(null);

  const loadNotes = useCallback(async () => {
    if (!isOpen || !ticker) return;

    const requestId = ++currentRequest.current;
    setLoading(true);
    setError("");

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in to view your stock notes.");

      const { data: noteRows, error: notesError } = await supabase
        .from("stock_notes")
        .select("id, ticker, created_at")
        .eq("user_id", user.id)
        .eq("ticker", ticker)
        .order("created_at", { ascending: false });
      if (notesError) throw notesError;

      const ids = (noteRows || []).map((note) => note.id);
      let entries = [];
      if (ids.length) {
        const { data, error: entriesError } = await supabase
          .from("stock_note_entries")
          .select("id, note_id, body, created_at, edited_at")
          .eq("user_id", user.id)
          .in("note_id", ids)
          .order("created_at", { ascending: true });
        if (entriesError) throw entriesError;
        entries = data || [];
      }

      const byNote = new Map();
      entries.forEach((entry) => {
        if (!byNote.has(entry.note_id)) byNote.set(entry.note_id, []);
        byNote.get(entry.note_id).push(entry);
      });

      const combined = (noteRows || [])
        .map((note) => ({ ...note, entries: sortEntries(byNote.get(note.id) || []) }))
        .filter((note) => note.entries.length > 0)
        .sort((a, b) => noteLastActivity(b).localeCompare(noteLastActivity(a)));

      if (currentRequest.current === requestId) setNotes(combined);
    } catch (err) {
      if (currentRequest.current === requestId) {
        console.error("Failed loading stock notes", err);
        setError(err.message || "Unable to load notes.");
      }
    } finally {
      if (currentRequest.current === requestId) setLoading(false);
    }
  }, [isOpen, ticker]);

  useEffect(() => {
    if (isOpen) {
      setDraft("");
      setComposer(null);
      loadNotes();
    } else {
      ++currentRequest.current;
      setNotes([]);
      setError("");
    }
    return () => { ++currentRequest.current; };
  }, [isOpen, loadNotes]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onEscape = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose, saving]);

  const beginCompose = (target, initialText = "") => {
    setError("");
    setComposer(target);
    setDraft(initialText);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const cancelCompose = () => {
    setComposer(null);
    setDraft("");
  };

  const save = async () => {
    const body = draft.trim();
    if (!composer || !body || saving || body.length > 20000) return;
    // A no-op edit shouldn't reset the user's original last-edited date.
    if (composer.mode === "edit" && body === composer.originalBody) return;

    setSaving(true);
    setError("");

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in to save a note.");

      if (composer.mode === "new") {
        const { data: parent, error: parentError } = await supabase
          .from("stock_notes")
          .insert({ user_id: user.id, ticker })
          .select("id")
          .single();
        if (parentError) throw parentError;

        const { error: entryError } = await supabase
          .from("stock_note_entries")
          .insert({ note_id: parent.id, user_id: user.id, body });
        if (entryError) {
          // Best-effort cleanup so a failed entry doesn't leave an empty note.
          await supabase.from("stock_notes").delete().eq("id", parent.id).eq("user_id", user.id);
          throw entryError;
        }
      } else if (composer.mode === "append") {
        const { error: entryError } = await supabase
          .from("stock_note_entries")
          .insert({ note_id: composer.noteId, user_id: user.id, body });
        if (entryError) throw entryError;
      } else if (composer.mode === "edit") {
        // Only the text is client-editable. Supabase sets edited_at automatically
        // through the database trigger installed in the edit migration.
        const { data: updatedEntry, error: editError } = await supabase
          .from("stock_note_entries")
          .update({ body })
          .eq("id", composer.entryId)
          .eq("note_id", composer.noteId)
          .eq("user_id", user.id)
          .select("id")
          .single();
        if (editError) throw editError;
        if (!updatedEntry) throw new Error("The note was not updated. Please try again.");
      } else {
        return;
      }

      cancelCompose();
      onNotesChanged?.();
      await loadNotes();
    } catch (err) {
      console.error("Failed saving stock note", err);
      setError(err.message || "Could not save the note.");
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id) => {
    if (!window.confirm("Delete this entire note and all of its dated additions?")) return;
    setSaving(true);
    setError("");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in to delete a note.");
      const { error: deleteError } = await supabase.from("stock_notes")
        .delete().eq("id", id).eq("user_id", user.id);
      if (deleteError) throw deleteError;
      if (composer?.noteId === id) cancelCompose();
      onNotesChanged?.();
      await loadNotes();
    } catch (err) {
      console.error("Failed deleting stock note", err);
      setError(err.message || "Could not delete the note.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const isUnchangedEdit = composer?.mode === "edit" && draft.trim() === composer.originalBody;

  return (
    <div className="stock-notes-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="stock-notes-dialog" role="dialog" aria-modal="true" aria-label={`${ticker} stock notes`}>
        <header className="stock-notes-header">
          <div>
            <h2>{ticker} — My Notes</h2>
            <p>Private investment notes saved to your Bullionaire account</p>
          </div>
          <button type="button" className="stock-notes-close" onClick={onClose} disabled={saving} aria-label="Close notes">×</button>
        </header>

        <div className="stock-notes-content">
          {error && <div className="stock-notes-error" role="alert">{error}</div>}
          {loading ? <p className="stock-notes-muted">Loading notes…</p> : (
            <>
              {!notes.length && <p className="stock-notes-muted">No notes saved for {ticker} yet.</p>}
              {notes.map((note) => {
                const first = note.created_at;
                const last = noteLastActivity(note);
                const range = formatDate(first) === formatDate(last)
                  ? formatDate(first)
                  : `${formatDate(first)} – ${formatDate(last)}`;
                return (
                  <article className="stock-notes-card" key={note.id}>
                    <div className="stock-notes-card-heading">
                      <strong>{range}</strong>
                      <button type="button" className="stock-notes-link stock-notes-delete" onClick={() => deleteNote(note.id)} disabled={saving}>Delete note</button>
                    </div>
                    {note.entries.map((entry) => (
                      <div className="stock-notes-entry" key={entry.id}>
                        <div className="stock-notes-entry-heading">
                          <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
                          <div className="stock-notes-entry-actions">
                            {entry.edited_at && (
                              <span className="stock-notes-edited-date">Edited {formatDate(entry.edited_at)}</span>
                            )}
                            <button
                              type="button"
                              className="stock-notes-link stock-notes-edit"
                              disabled={saving}
                              onClick={() => beginCompose({
                                mode: "edit",
                                noteId: note.id,
                                entryId: entry.id,
                                originalBody: entry.body,
                              }, entry.body)}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                        <p>{entry.body}</p>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="stock-notes-add"
                      disabled={saving}
                      onClick={() => beginCompose({ mode: "append", noteId: note.id })}
                    >
                      + Add to this note
                    </button>
                  </article>
                );
              })}
            </>
          )}

          {composer && (
            <div className="stock-notes-compose">
              <label htmlFor="stock-notes-draft">
                {composer.mode === "new" ? "New note" : composer.mode === "edit" ? "Edit existing text" : "Add a dated update"}
              </label>
              <textarea
                id="stock-notes-draft"
                ref={textareaRef}
                value={draft}
                maxLength={20000}
                onChange={(event) => setDraft(event.target.value)}
                rows={5}
                placeholder="Write your investment thesis, observations, or follow-up…"
                disabled={saving}
              />
              <p>
                {composer.mode === "edit"
                  ? "Editing replaces this entry's text. Its original creation date stays the same, and the last-edited date updates when you save."
                  : "Each addition is saved with its own date. Earlier writing is preserved."}
              </p>
              <div className="stock-notes-composer-actions">
                <button type="button" className="stock-notes-secondary" onClick={cancelCompose} disabled={saving}>Cancel</button>
                <button
                  type="button"
                  className="stock-notes-primary"
                  onClick={save}
                  disabled={saving || !draft.trim() || isUnchangedEdit}
                >
                  {saving ? "Saving…" : composer.mode === "edit" ? "Save Changes" : "Save note"}
                </button>
              </div>
            </div>
          )}
        </div>
        <footer className="stock-notes-footer">
          <button type="button" className="stock-notes-primary" onClick={() => beginCompose({ mode: "new" })} disabled={saving || loading}>+ New Note</button>
        </footer>
      </section>
    </div>
  );
}