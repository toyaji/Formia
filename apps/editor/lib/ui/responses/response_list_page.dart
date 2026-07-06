import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:form_factor/form_factor.dart';
import 'package:formia_data/formia_data.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../l10n/app_localizations.dart';
import '../../providers/form_document_controller.dart';
import '../../providers/responses_controller.dart';
import '../../service/csv_export.dart';
import '../../theme.dart';

/// Owner response dashboard (03 §6 DoD: view responses / export CSV / basic
/// aggregation). Reachable from the dashboard once a form is published.
///
/// Scope note: "completion rate" / "drop-off point" from 03 §6 need
/// per-session progress tracking that the current schema doesn't capture
/// (only fully-submitted responses are stored) — so this shows total count +
/// per-question distribution only, not funnel/drop-off metrics.
class ResponseListPage extends ConsumerWidget {
  const ResponseListPage({super.key, required this.formId});

  final String formId;

  List<FormBlock> _answerableBlocks(FormFactor doc) => [
        for (final page in doc.pages)
          if (page.role == PageRole.question)
            for (final block in page.blocks)
              if (block.content is! InfoContent && block.content is! StatementContent) block,
      ];

  String _cellText(FormBlock block, Object? raw) {
    if (raw == null) return '';
    final content = block.content;
    if (content is ChoiceContent) {
      final ids = raw is List ? raw.map((e) => e.toString()) : [raw.toString()];
      return ids
          .map((id) => content.options.firstWhere(
                (o) => o.id == id,
                orElse: () => ChoiceOption(id: id, label: id),
              ).label)
          .join('; ');
    }
    return raw.toString();
  }

  void _exportCsv(BuildContext context, WidgetRef ref, FormFactor doc, List<ResponseRecord> responses) {
    final t = AppLocalizations.of(context)!;
    final blocks = _answerableBlocks(doc);
    final header = [t.submittedAt, for (final b in blocks) _blockLabel(b)];
    final rows = [
      header,
      for (final r in responses)
        [
          r.submittedAt.toIso8601String(),
          for (final b in blocks) _cellText(b, r.data[b.id]),
        ],
    ];
    final csv = rows.map((row) => row.map(_csvField).join(',')).join('\r\n');
    downloadCsv('${doc.metadata.title}_responses.csv', csv);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t.csvCopiedToClipboard)));
  }

  String _csvField(String field) {
    if (field.contains(',') || field.contains('"') || field.contains('\n')) {
      return '"${field.replaceAll('"', '""')}"';
    }
    return field;
  }

  String _blockLabel(FormBlock b) => switch (b.content) {
        TextContent(:final label) => label,
        TextAreaContent(:final label) => label,
        ChoiceContent(:final label) => label,
        RatingContent(:final label) => label,
        DateContent(:final label) => label,
        FileContent(:final label) => label,
        _ => b.id,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final doc = ref.watch(formDocumentControllerProvider(formId)).doc;
    final responsesAsync = ref.watch(responsesControllerProvider(formId));

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        title: Text(t.responsesTitle),
        actions: [
          IconButton(
            tooltip: t.exportCsv,
            icon: const Icon(Icons.download_outlined),
            onPressed: doc == null
                ? null
                : () => responsesAsync.whenData((rs) => _exportCsv(context, ref, doc, rs)),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: doc == null
          ? const Center(child: CircularProgressIndicator())
          : responsesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, st) => Center(child: Text('${t.loadError}: $e')),
              data: (responses) {
                if (responses.isEmpty) {
                  return Center(child: Text(t.noResponses));
                }
                final blocks = _answerableBlocks(doc);
                return ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    Text('${t.totalResponses}: ${responses.length}',
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    const SizedBox(height: 20),
                    _DistributionSection(blocks: blocks, responses: responses, blockLabel: _blockLabel),
                    const SizedBox(height: 24),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: DataTable(
                        columns: [
                          DataColumn(label: Text(t.submittedAt)),
                          for (final b in blocks) DataColumn(label: Text(_blockLabel(b))),
                        ],
                        rows: [
                          for (final r in responses)
                            DataRow(cells: [
                              DataCell(Text(DateFormat.yMMMd().add_Hm().format(r.submittedAt))),
                              for (final b in blocks) DataCell(Text(_cellText(b, r.data[b.id]))),
                            ]),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
    );
  }
}

class _DistributionSection extends StatelessWidget {
  const _DistributionSection({required this.blocks, required this.responses, required this.blockLabel});

  final List<FormBlock> blocks;
  final List<ResponseRecord> responses;
  final String Function(FormBlock) blockLabel;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final distributable = blocks.where((b) => b.content is ChoiceContent || b.content is RatingContent).toList();
    if (distributable.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(t.distributionTitle, style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        for (final b in distributable) _BlockDistribution(block: b, responses: responses, label: blockLabel(b)),
      ],
    );
  }
}

class _BlockDistribution extends StatelessWidget {
  const _BlockDistribution({required this.block, required this.responses, required this.label});

  final FormBlock block;
  final List<ResponseRecord> responses;
  final String label;

  @override
  Widget build(BuildContext context) {
    final counts = <String, int>{};
    for (final r in responses) {
      final raw = r.data[block.id];
      if (raw == null) continue;
      final key = _labelFor(raw);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    if (counts.isEmpty) return const SizedBox.shrink();
    final maxCount = counts.values.reduce((a, b) => a > b ? a : b);

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 4),
          for (final entry in counts.entries)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  SizedBox(width: 100, child: Text(entry.key, overflow: TextOverflow.ellipsis, maxLines: 1)),
                  Expanded(
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: entry.value / maxCount,
                      child: Container(height: 8, color: FormiaColors.primary),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('${entry.value}', style: const TextStyle(fontSize: 12, color: FormiaColors.textMuted)),
                ],
              ),
            ),
        ],
      ),
    );
  }

  String _labelFor(Object raw) {
    final content = block.content;
    if (content is ChoiceContent) {
      final id = raw.toString();
      return content.options.firstWhere((o) => o.id == id, orElse: () => ChoiceOption(id: id, label: id)).label;
    }
    return raw.toString();
  }
}
