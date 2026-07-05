import 'package:flutter_riverpod/flutter_riverpod.dart';

enum EditorViewport { desktop, mobile }

/// Builder UI selection/viewport state (02 §2 `editorSelectionProvider`).
/// Deliberately separate from [FormDocState] — selecting a block/page is not
/// a document edit and must not enter the undo/redo history.
class EditorSelection {
  const EditorSelection({
    this.activePageId,
    this.activeBlockId,
    this.viewport = EditorViewport.desktop,
    this.previewMode = false,
  });

  final String? activePageId;
  final String? activeBlockId;
  final EditorViewport viewport;
  final bool previewMode;

  EditorSelection copyWith({
    String? activePageId,
    bool clearActivePageId = false,
    String? activeBlockId,
    bool clearActiveBlockId = false,
    EditorViewport? viewport,
    bool? previewMode,
  }) =>
      EditorSelection(
        activePageId:
            clearActivePageId ? null : (activePageId ?? this.activePageId),
        activeBlockId:
            clearActiveBlockId ? null : (activeBlockId ?? this.activeBlockId),
        viewport: viewport ?? this.viewport,
        previewMode: previewMode ?? this.previewMode,
      );
}

class EditorSelectionController extends Notifier<EditorSelection> {
  @override
  EditorSelection build() => const EditorSelection();

  void selectPage(String pageId) => state = state.copyWith(
        activePageId: pageId,
        clearActiveBlockId: true,
      );

  void selectBlock(String? blockId) => state = state.copyWith(
        activeBlockId: blockId,
        clearActiveBlockId: blockId == null,
      );

  void toggleViewport() => state = state.copyWith(
        viewport: state.viewport == EditorViewport.desktop
            ? EditorViewport.mobile
            : EditorViewport.desktop,
      );

  void togglePreview() => state = state.copyWith(previewMode: !state.previewMode);
}

final editorSelectionProvider =
    NotifierProvider<EditorSelectionController, EditorSelection>(
  EditorSelectionController.new,
);
