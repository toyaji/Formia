import 'package:flutter/material.dart';
import 'package:form_factor/form_factor.dart';

import '../../l10n/app_localizations.dart';

enum BlockViewMode { edit, preview }

/// Single renderer for a [FormBlock] shared by edit and preview (02 §6): one
/// switch over the sealed [BlockContent], no separate builder/viewer widgets.
class BlockView extends StatelessWidget {
  const BlockView({
    super.key,
    required this.block,
    required this.mode,
    this.onChanged,
    this.onDelete,
    this.selected = false,
    this.onTap,
  });

  final FormBlock block;
  final BlockViewMode mode;
  final ValueChanged<BlockContent>? onChanged;
  final VoidCallback? onDelete;
  final bool selected;
  final VoidCallback? onTap;

  bool get _edit => mode == BlockViewMode.edit;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final content = _buildContent(context);
    if (!_edit) {
      return Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: content);
    }
    return Card(
      elevation: selected ? 2 : 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: selected ? Theme.of(context).colorScheme.primary : Colors.transparent,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.drag_indicator, size: 20),
              const SizedBox(width: 8),
              Expanded(child: content),
              if (block.removable)
                IconButton(
                  tooltip: t.deleteBlock,
                  icon: const Icon(Icons.delete_outline, size: 20),
                  onPressed: onDelete,
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final c = block.content;
    return switch (c) {
      TextContent() => _TextBlockEditor(key: ValueKey(block.id), content: c, edit: _edit, onChanged: onChanged),
      TextAreaContent() => _TextAreaBlockEditor(key: ValueKey(block.id), content: c, edit: _edit, onChanged: onChanged),
      ChoiceContent() => _ChoiceBlockEditor(key: ValueKey(block.id), content: c, edit: _edit, onChanged: onChanged),
      RatingContent() => _RatingBlockEditor(key: ValueKey(block.id), content: c, edit: _edit, onChanged: onChanged),
      DateContent() => _DateBlockEditor(key: ValueKey(block.id), content: c, edit: _edit, onChanged: onChanged),
      FileContent() => _FileBlockEditor(key: ValueKey(block.id), content: c, edit: _edit, onChanged: onChanged),
      InfoContent() => _InfoBlockEditor(key: ValueKey(block.id), content: c, edit: _edit, onChanged: onChanged, label: t.infoBody),
      StatementContent() => _StatementBlockEditor(key: ValueKey(block.id), content: c, edit: _edit, onChanged: onChanged),
    };
  }
}

class _TextBlockEditor extends StatelessWidget {
  const _TextBlockEditor({super.key, required this.content, required this.edit, this.onChanged});
  final TextContent content;
  final bool edit;
  final ValueChanged<BlockContent>? onChanged;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (!edit) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(content.label, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          TextField(enabled: false, decoration: InputDecoration(hintText: content.placeholder, border: const OutlineInputBorder())),
        ],
      );
    }
    return TextFormField(
      initialValue: content.label,
      decoration: InputDecoration(labelText: t.questionLabel),
      onChanged: (v) => onChanged?.call(content.copyWith(label: v)),
    );
  }
}

class _TextAreaBlockEditor extends StatelessWidget {
  const _TextAreaBlockEditor({super.key, required this.content, required this.edit, this.onChanged});
  final TextAreaContent content;
  final bool edit;
  final ValueChanged<BlockContent>? onChanged;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (!edit) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(content.label, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          TextField(enabled: false, maxLines: 3, decoration: InputDecoration(hintText: content.placeholder, border: const OutlineInputBorder())),
        ],
      );
    }
    return TextFormField(
      initialValue: content.label,
      decoration: InputDecoration(labelText: t.questionLabel),
      onChanged: (v) => onChanged?.call(content.copyWith(label: v)),
    );
  }
}

class _ChoiceBlockEditor extends StatelessWidget {
  const _ChoiceBlockEditor({super.key, required this.content, required this.edit, this.onChanged});
  final ChoiceContent content;
  final bool edit;
  final ValueChanged<BlockContent>? onChanged;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (!edit) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(content.label, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          for (final o in content.options)
            Row(children: [
              Icon(content.multiSelect ? Icons.check_box_outline_blank : Icons.radio_button_off, size: 18),
              const SizedBox(width: 8),
              Text(o.label),
            ]),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          initialValue: content.label,
          decoration: InputDecoration(labelText: t.questionLabel),
          onChanged: (v) => onChanged?.call(content.copyWith(label: v)),
        ),
        const SizedBox(height: 8),
        TextFormField(
          initialValue: content.options.map((o) => o.label).join(', '),
          decoration: InputDecoration(labelText: t.choiceOptions),
          onChanged: (v) {
            final labels = v.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
            onChanged?.call(content.copyWith(
              options: [
                for (var i = 0; i < labels.length; i++) ChoiceOption(id: 'opt_$i', label: labels[i]),
              ],
            ));
          },
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(t.multiSelect),
          value: content.multiSelect,
          onChanged: (v) => onChanged?.call(content.copyWith(multiSelect: v)),
        ),
      ],
    );
  }
}

class _RatingBlockEditor extends StatelessWidget {
  const _RatingBlockEditor({super.key, required this.content, required this.edit, this.onChanged});
  final RatingContent content;
  final bool edit;
  final ValueChanged<BlockContent>? onChanged;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (!edit) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(content.label, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Row(children: [for (var i = 0; i < content.maxRating; i++) const Icon(Icons.star_border)]),
        ],
      );
    }
    return Row(
      children: [
        Expanded(
          child: TextFormField(
            initialValue: content.label,
            decoration: InputDecoration(labelText: t.questionLabel),
            onChanged: (v) => onChanged?.call(content.copyWith(label: v)),
          ),
        ),
        const SizedBox(width: 12),
        DropdownButton<int>(
          value: content.maxRating,
          items: [for (final n in [3, 5, 7, 10]) DropdownMenuItem(value: n, child: Text('$n'))],
          onChanged: (v) {
            if (v != null) onChanged?.call(content.copyWith(maxRating: v));
          },
        ),
      ],
    );
  }
}

class _DateBlockEditor extends StatelessWidget {
  const _DateBlockEditor({super.key, required this.content, required this.edit, this.onChanged});
  final DateContent content;
  final bool edit;
  final ValueChanged<BlockContent>? onChanged;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (!edit) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(content.label, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          const TextField(enabled: false, decoration: InputDecoration(prefixIcon: Icon(Icons.calendar_today), border: OutlineInputBorder())),
        ],
      );
    }
    return Row(
      children: [
        Expanded(
          child: TextFormField(
            initialValue: content.label,
            decoration: InputDecoration(labelText: t.questionLabel),
            onChanged: (v) => onChanged?.call(content.copyWith(label: v)),
          ),
        ),
        const SizedBox(width: 12),
        Text(t.includeTime),
        Switch(
          value: content.includeTime,
          onChanged: (v) => onChanged?.call(content.copyWith(includeTime: v)),
        ),
      ],
    );
  }
}

class _FileBlockEditor extends StatelessWidget {
  const _FileBlockEditor({super.key, required this.content, required this.edit, this.onChanged});
  final FileContent content;
  final bool edit;
  final ValueChanged<BlockContent>? onChanged;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (!edit) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(content.label, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          OutlinedButton.icon(onPressed: null, icon: const Icon(Icons.upload_file), label: const Text('—')),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          initialValue: content.label,
          decoration: InputDecoration(labelText: t.questionLabel),
          onChanged: (v) => onChanged?.call(content.copyWith(label: v)),
        ),
        const SizedBox(height: 8),
        TextFormField(
          initialValue: content.acceptedTypes.join(', '),
          decoration: InputDecoration(labelText: t.acceptedTypes),
          onChanged: (v) => onChanged?.call(content.copyWith(
            acceptedTypes: v.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
          )),
        ),
      ],
    );
  }
}

class _InfoBlockEditor extends StatelessWidget {
  const _InfoBlockEditor({super.key, required this.content, required this.edit, this.onChanged, required this.label});
  final InfoContent content;
  final bool edit;
  final ValueChanged<BlockContent>? onChanged;
  final String label;

  @override
  Widget build(BuildContext context) {
    if (!edit) return Text(content.body, style: Theme.of(context).textTheme.bodyLarge);
    return TextFormField(
      initialValue: content.body,
      maxLines: 3,
      decoration: InputDecoration(labelText: label),
      onChanged: (v) => onChanged?.call(content.copyWith(body: v)),
    );
  }
}

class _StatementBlockEditor extends StatelessWidget {
  const _StatementBlockEditor({super.key, required this.content, required this.edit, this.onChanged});
  final StatementContent content;
  final bool edit;
  final ValueChanged<BlockContent>? onChanged;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (!edit) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (content.label != null) Text(content.label!, style: Theme.of(context).textTheme.titleMedium),
          if (content.body != null) Text(content.body!),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          initialValue: content.label ?? '',
          decoration: InputDecoration(labelText: t.questionLabel),
          onChanged: (v) => onChanged?.call(content.copyWith(label: v)),
        ),
        const SizedBox(height: 8),
        TextFormField(
          initialValue: content.body ?? '',
          maxLines: 2,
          decoration: InputDecoration(labelText: t.infoBody),
          onChanged: (v) => onChanged?.call(content.copyWith(body: v)),
        ),
      ],
    );
  }
}
