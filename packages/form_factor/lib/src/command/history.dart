/// Immutable undo/redo history over a [FormFactor], driven by [FormCommand]s.
///
/// Each entry stores the document snapshot *before* a command plus the
/// command's [CommandMeta] (author/timestamp/description) — the basis for a
/// change log and checkpoints (02 §3). Because the model is immutable, storing
/// the previous reference is enough (no deep clone).
library;

import 'package:meta/meta.dart';

import '../model/form_factor.dart';
import 'commands.dart';

@immutable
class HistoryEntry {
  const HistoryEntry({required this.before, required this.meta});

  final FormFactor before;
  final CommandMeta meta;
}

@immutable
class DocHistory {
  const DocHistory({
    required this.doc,
    this.undoStack = const [],
    this.redoStack = const [],
    this.limit = 100,
  });

  final FormFactor doc;
  final List<HistoryEntry> undoStack;
  final List<HistoryEntry> redoStack;
  final int limit;

  bool get canUndo => undoStack.isNotEmpty;
  bool get canRedo => redoStack.isNotEmpty;

  /// Applies [cmd]. If `cmd.apply` throws, the exception propagates and this
  /// history is left unchanged (atomic — see [AiTurnCommand]).
  DocHistory execute(FormCommand cmd) {
    final next = cmd.apply(doc); // may throw → caller keeps old history
    final undo = [
      ...undoStack,
      HistoryEntry(before: doc, meta: cmd.meta),
    ];
    final trimmed =
        undo.length > limit ? undo.sublist(undo.length - limit) : undo;
    return DocHistory(
      doc: next,
      undoStack: trimmed,
      redoStack: const [],
      limit: limit,
    );
  }

  DocHistory undo() {
    if (undoStack.isEmpty) return this;
    final entry = undoStack.last;
    return DocHistory(
      doc: entry.before,
      undoStack: undoStack.sublist(0, undoStack.length - 1),
      redoStack: [...redoStack, HistoryEntry(before: doc, meta: entry.meta)],
      limit: limit,
    );
  }

  DocHistory redo() {
    if (redoStack.isEmpty) return this;
    final entry = redoStack.last;
    return DocHistory(
      doc: entry.before,
      undoStack: [...undoStack, HistoryEntry(before: doc, meta: entry.meta)],
      redoStack: redoStack.sublist(0, redoStack.length - 1),
      limit: limit,
    );
  }
}
