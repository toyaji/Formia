import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:form_factor/form_factor.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../../l10n/app_localizations.dart';
import '../../l10n/domain_messages.dart';
import '../../providers/editor_selection_provider.dart';
import '../../providers/form_document_controller.dart';
import '../../providers/persistence_controller.dart';
import 'block_view.dart';

const _uuid = Uuid();

CommandMeta _meta(String code, [Map<String, Object?> params = const {}]) =>
    CommandMeta(
      author: CommandAuthor.human,
      timestamp: DateTime.now().toIso8601String(),
      code: code,
      params: params,
    );

BlockContent _defaultContentFor(String type) => switch (type) {
      'text' => const TextContent(label: '질문'),
      'textarea' => const TextAreaContent(label: '질문'),
      'choice' => const ChoiceContent(
          label: '질문',
          options: [ChoiceOption(id: 'opt_0', label: '옵션 1'), ChoiceOption(id: 'opt_1', label: '옵션 2')],
        ),
      'rating' => const RatingContent(label: '질문'),
      'date' => const DateContent(label: '질문'),
      'file' => const FileContent(label: '질문'),
      'info' => const InfoContent(body: '안내 문구를 입력하세요'),
      'statement' => const StatementContent(label: '제목', body: '설명'),
      _ => const TextContent(label: '질문'),
    };

class BuilderPage extends ConsumerWidget {
  const BuilderPage({super.key, required this.formId});

  final String formId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final docState = ref.watch(formDocumentControllerProvider(formId));
    final controller = ref.read(formDocumentControllerProvider(formId).notifier);
    final selection = ref.watch(editorSelectionProvider);
    final selectionController = ref.read(editorSelectionProvider.notifier);
    final saveStatus = ref.watch(persistenceControllerProvider(formId));

    if (docState.loading || docState.doc == null) {
      if (docState.error != null) {
        return Scaffold(body: Center(child: Text('${t.loadError}: ${docState.error}')));
      }
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final doc = docState.doc!;
    final activePageId = selection.activePageId ?? doc.pages.first.id;
    final activePage = doc.pages.firstWhere((p) => p.id == activePageId, orElse: () => doc.pages.first);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.go('/dashboard')),
        title: Text(doc.metadata.title.isEmpty ? t.untitledForm : doc.metadata.title),
        actions: [
          _SaveStatusLabel(status: saveStatus),
          IconButton(
            tooltip: t.undo,
            icon: const Icon(Icons.undo),
            onPressed: docState.canUndo ? controller.undo : null,
          ),
          IconButton(
            tooltip: t.redo,
            icon: const Icon(Icons.redo),
            onPressed: docState.canRedo ? controller.redo : null,
          ),
          IconButton(
            tooltip: selection.viewport == EditorViewport.desktop ? t.viewportMobile : t.viewportDesktop,
            icon: Icon(selection.viewport == EditorViewport.desktop ? Icons.phone_iphone : Icons.desktop_windows),
            onPressed: selectionController.toggleViewport,
          ),
          IconButton(
            tooltip: selection.previewMode ? t.editToggle : t.previewToggle,
            icon: Icon(selection.previewMode ? Icons.edit : Icons.visibility),
            onPressed: selectionController.togglePreview,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Row(
        children: [
          SizedBox(
            width: 220,
            child: _PageNav(
              pages: doc.pages,
              activePageId: activePageId,
              onSelect: selectionController.selectPage,
            ),
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child: Column(
              children: [
                if (docState.error != null)
                  MaterialBanner(
                    content: Text(_errorMessage(docState.error)),
                    actions: [TextButton(onPressed: () {}, child: const Text('OK'))],
                  ),
                Expanded(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth: selection.viewport == EditorViewport.mobile ? 390 : 720,
                      ),
                      child: selection.previewMode
                          ? _PreviewCanvas(page: activePage)
                          : _EditCanvas(
                              formId: formId,
                              page: activePage,
                              selectedBlockId: selection.activeBlockId,
                              controller: controller,
                              selectionController: selectionController,
                            ),
                    ),
                  ),
                ),
                if (!selection.previewMode) _AddBlockToolbar(pageId: activePage.id, controller: controller),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _errorMessage(Object? error) {
    if (error is FormFactorViolation) return domainMessageKo(error.code, error.params);
    return error.toString();
  }
}

class _SaveStatusLabel extends StatelessWidget {
  const _SaveStatusLabel({required this.status});
  final SaveStatus status;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final label = switch (status) {
      SaveStatus.idle => t.saveStatusIdle,
      SaveStatus.saving => t.saveStatusSaving,
      SaveStatus.saved => t.saveStatusSaved,
      SaveStatus.error => t.saveStatusError,
    };
    if (label.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Center(
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: status == SaveStatus.error ? Theme.of(context).colorScheme.error : null,
              ),
        ),
      ),
    );
  }
}

class _PageNav extends StatelessWidget {
  const _PageNav({required this.pages, required this.activePageId, required this.onSelect});
  final List<FormPage> pages;
  final String activePageId;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return ListView(
      children: [
        for (final page in pages)
          ListTile(
            selected: page.id == activePageId,
            leading: Icon(switch (page.role) {
              PageRole.start => Icons.flag_outlined,
              PageRole.question => Icons.description_outlined,
              PageRole.ending => Icons.check_circle_outline,
            }),
            title: Text(page.title.isEmpty ? _roleLabel(t, page.role) : page.title, maxLines: 1, overflow: TextOverflow.ellipsis),
            onTap: () => onSelect(page.id),
          ),
      ],
    );
  }

  String _roleLabel(AppLocalizations t, PageRole role) => switch (role) {
        PageRole.start => t.pageStart,
        PageRole.question => t.pageQuestion,
        PageRole.ending => t.pageEnding,
      };
}

class _EditCanvas extends StatelessWidget {
  const _EditCanvas({
    required this.formId,
    required this.page,
    required this.selectedBlockId,
    required this.controller,
    required this.selectionController,
  });

  final String formId;
  final FormPage page;
  final String? selectedBlockId;
  final FormDocumentController controller;
  final EditorSelectionController selectionController;

  @override
  Widget build(BuildContext context) {
    return ReorderableListView.builder(
      buildDefaultDragHandles: false,
      padding: const EdgeInsets.all(16),
      itemCount: page.blocks.length,
      onReorderItem: (oldIndex, newIndex) {
        final block = page.blocks[oldIndex];
        controller.execute(MoveBlockCommand(
          blockId: block.id,
          toPageId: page.id,
          toIndex: newIndex,
          meta: _meta('block.reorder', {'blockId': block.id}),
        ));
      },
      itemBuilder: (context, index) {
        final block = page.blocks[index];
        return ReorderableDragStartListener(
          key: ValueKey(block.id),
          index: index,
          child: BlockView(
            block: block,
            mode: BlockViewMode.edit,
            selected: block.id == selectedBlockId,
            onTap: () => selectionController.selectBlock(block.id),
            onChanged: (content) => controller.execute(UpdateBlockContentCommand(
              blockId: block.id,
              content: content,
              meta: _meta('block.update', {'blockId': block.id}),
            )),
            onDelete: () => controller.execute(RemoveBlockCommand(
              blockId: block.id,
              meta: _meta('block.remove', {'blockId': block.id}),
            )),
          ),
        );
      },
    );
  }
}

class _PreviewCanvas extends StatelessWidget {
  const _PreviewCanvas({required this.page});
  final FormPage page;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(page.title, style: Theme.of(context).textTheme.headlineSmall),
        if (page.description != null) ...[const SizedBox(height: 4), Text(page.description!)],
        const SizedBox(height: 16),
        for (final block in page.blocks) BlockView(block: block, mode: BlockViewMode.preview),
      ],
    );
  }
}

class _AddBlockToolbar extends StatelessWidget {
  const _AddBlockToolbar({required this.pageId, required this.controller});
  final String pageId;
  final FormDocumentController controller;

  static const _types = [
    ('text', Icons.short_text),
    ('textarea', Icons.notes),
    ('choice', Icons.checklist),
    ('rating', Icons.star_outline),
    ('date', Icons.calendar_today_outlined),
    ('file', Icons.upload_file_outlined),
    ('info', Icons.info_outline),
    ('statement', Icons.horizontal_rule),
  ];

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Material(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final (type, icon) in _types)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: OutlinedButton.icon(
                    icon: Icon(icon, size: 18),
                    label: Text(_typeLabel(t, type)),
                    onPressed: () => controller.execute(AddBlockCommand(
                      pageId: pageId,
                      block: FormBlock(id: _uuid.v4(), content: _defaultContentFor(type)),
                      meta: _meta('block.add', {'type': type}),
                    )),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _typeLabel(AppLocalizations t, String type) => switch (type) {
        'text' => t.blockTypeText,
        'textarea' => t.blockTypeTextarea,
        'choice' => t.blockTypeChoice,
        'rating' => t.blockTypeRating,
        'date' => t.blockTypeDate,
        'file' => t.blockTypeFile,
        'info' => t.blockTypeInfo,
        'statement' => t.blockTypeStatement,
        _ => type,
      };
}
