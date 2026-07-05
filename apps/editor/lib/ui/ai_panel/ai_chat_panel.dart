import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../../providers/agent_controller.dart';
import '../../providers/byok_key_provider.dart';
import '../../theme.dart';

/// The agentic AI builder's chat surface (07 §8): streaming transcript,
/// inline tool-call cards, and an accept/reject bar for the turn's proposed
/// [AiTurnCommand] (Propose mode, 07 §5.2). Talks only to
/// `agentControllerProvider` — never touches `form_factor` directly.
class AiChatPanel extends ConsumerStatefulWidget {
  const AiChatPanel({super.key, required this.formId});

  final String formId;

  @override
  ConsumerState<AiChatPanel> createState() => _AiChatPanelState();
}

class _AiChatPanelState extends ConsumerState<AiChatPanel> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _send() {
    final text = _controller.text;
    if (text.trim().isEmpty) return;
    _controller.clear();
    ref.read(agentControllerProvider(widget.formId).notifier).sendMessage(text);
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final state = ref.watch(agentControllerProvider(widget.formId));
    final hasKey = ref.watch(byokKeyProvider) != null;

    return Material(
      color: FormiaColors.surface,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome, size: 18, color: FormiaColors.primary),
                const SizedBox(width: 8),
                Text(t.aiPanelTitle, style: const TextStyle(fontWeight: FontWeight.w700)),
                const Spacer(),
                IconButton(
                  tooltip: t.aiKeySettings,
                  icon: Icon(Icons.vpn_key, size: 18, color: hasKey ? FormiaColors.success : FormiaColors.textMuted),
                  onPressed: () => _showKeyDialog(context, ref),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: FormiaColors.border),
          Expanded(
            child: state.messages.isEmpty && state.streamingText.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        t.aiEmptyState,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: FormiaColors.textMuted),
                      ),
                    ),
                  )
                : ListView(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    children: [
                      for (final m in state.messages) _ChatBubble(entry: m),
                      if (state.streamingText.isNotEmpty)
                        _ChatBubble(entry: ChatEntry(role: ChatRole.assistant, content: state.streamingText)),
                      if (state.toolActivity.isNotEmpty) _ToolActivityList(activity: state.toolActivity),
                    ],
                  ),
          ),
          if (state.error != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              color: const Color(0xFFFFF5F5),
              child: Text(state.error!, style: const TextStyle(color: FormiaColors.danger, fontSize: 12)),
            ),
          if (state.pendingTurn != null)
            _PendingReviewBar(
              summaries: state.pendingStepSummaries,
              onAccept: () => ref.read(agentControllerProvider(widget.formId).notifier).acceptPendingTurn(),
              onReject: () => ref.read(agentControllerProvider(widget.formId).notifier).rejectPendingTurn(),
            ),
          const Divider(height: 1, color: FormiaColors.border),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    enabled: !state.isLocked,
                    decoration: InputDecoration(hintText: state.isLocked ? t.aiTurnLocked : t.aiInputHint),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: state.isLocked ? null : _send,
                  icon: const Icon(Icons.send, size: 18),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showKeyDialog(BuildContext context, WidgetRef ref) async {
    final t = AppLocalizations.of(context)!;
    final current = ref.read(byokKeyProvider);
    final controller = TextEditingController(text: current ?? '');
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(t.aiKeyDialogTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t.aiKeyDialogBody, style: const TextStyle(fontSize: 12, color: FormiaColors.textMuted)),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              obscureText: true,
              decoration: InputDecoration(hintText: t.aiKeyHint),
            ),
          ],
        ),
        actions: [
          if (current != null)
            TextButton(
              onPressed: () {
                ref.read(byokKeyProvider.notifier).clear();
                Navigator.of(context).pop();
              },
              child: Text(t.aiKeyClear),
            ),
          TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(t.cancel)),
          FilledButton(
            onPressed: () {
              final key = controller.text.trim();
              if (key.isNotEmpty) ref.read(byokKeyProvider.notifier).setKey(key);
              Navigator.of(context).pop();
            },
            child: Text(t.aiKeySave),
          ),
        ],
      ),
    );
  }
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({required this.entry});
  final ChatEntry entry;

  @override
  Widget build(BuildContext context) {
    final isUser = entry.role == ChatRole.user;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: const BoxConstraints(maxWidth: 320),
        decoration: BoxDecoration(
          color: isUser ? FormiaColors.primary : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(FormiaRadii.lg),
        ),
        child: Text(
          entry.content,
          style: TextStyle(color: isUser ? Colors.white : FormiaColors.textMain, fontSize: 13),
        ),
      ),
    );
  }
}

class _ToolActivityList extends StatelessWidget {
  const _ToolActivityList({required this.activity});
  final List<ToolActivity> activity;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final a in activity)
          Container(
            margin: const EdgeInsets.symmetric(vertical: 3),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: FormiaColors.surface,
              border: Border.all(color: FormiaColors.border),
              borderRadius: BorderRadius.circular(FormiaRadii.sm),
            ),
            child: Row(
              children: [
                Icon(
                  a.error != null
                      ? Icons.error_outline
                      : a.isPending
                          ? Icons.hourglass_top
                          : Icons.check_circle_outline,
                  size: 14,
                  color: a.error != null
                      ? FormiaColors.danger
                      : a.isPending
                          ? FormiaColors.textMuted
                          : FormiaColors.success,
                ),
                const SizedBox(width: 6),
                Text(a.name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
      ],
    );
  }
}

class _PendingReviewBar extends StatelessWidget {
  const _PendingReviewBar({required this.summaries, required this.onAccept, required this.onReject});
  final List<String> summaries;
  final VoidCallback onAccept;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.all(12),
      color: const Color(0xFFF6F9FF),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(t.aiPendingReviewTitle, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
          const SizedBox(height: 6),
          for (final s in summaries)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 1),
              child: Text('· $s', style: const TextStyle(fontSize: 12, color: FormiaColors.textMuted)),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(onPressed: onReject, child: Text(t.aiReject)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton(onPressed: onAccept, child: Text(t.aiAccept)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
