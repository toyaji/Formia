import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../l10n/app_localizations.dart';
import '../../providers/auth_controller.dart';
import '../../providers/forms_list_controller.dart';
import '../../repository/local_draft_repository.dart';
import '../../theme.dart';
import '../shared/restore_draft_prompt.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  bool _promptChecked = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_promptChecked) {
      _promptChecked = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybePromptRestore());
    }
  }

  Future<void> _maybePromptRestore() async {
    if (!mounted) return;
    final isGuest = !ref.read(authControllerProvider).isLoggedIn;
    if (!isGuest) return;
    final hasDraft = await LocalDraftRepository.hasAnyDraft();
    if (!hasDraft || !mounted) return;
    final restore = await showRestoreDraftPrompt(context);
    if (restore == true && mounted) {
      final forms = await ref.read(formsListControllerProvider.future);
      if (forms.isNotEmpty && mounted) {
        context.push('/editor/${forms.first.id}');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final auth = ref.watch(authControllerProvider);
    final formsAsync = ref.watch(formsListControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const FormiaWordmark(fontSize: 20),
            const SizedBox(width: 16),
            Container(width: 1, height: 18, color: FormiaColors.border),
            const SizedBox(width: 16),
            Text(t.dashboardTitle),
          ],
        ),
        actions: [
          if (auth.isLoggedIn)
            IconButton(
              tooltip: t.signOut,
              icon: const Icon(Icons.logout),
              onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
            )
          else
            TextButton(
              onPressed: () => context.go('/login'),
              child: Text(t.loginWithGoogle),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final id = await ref.read(formsListControllerProvider.notifier).createBlank();
          if (id != null && context.mounted) context.push('/editor/$id');
        },
        icon: const Icon(Icons.add),
        label: Text(t.createForm),
      ),
      body: formsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, st) => Center(child: Text('${t.loadError}: $e')),
        data: (forms) {
          if (forms.isEmpty) {
            return Center(child: Text(t.emptyFormsList));
          }
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1000),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Card(
                  clipBehavior: Clip.antiAlias,
                  margin: EdgeInsets.zero,
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: forms.length,
                    separatorBuilder: (_, _) => Divider(height: 1, color: FormiaColors.border),
                    itemBuilder: (context, index) {
                      final form = forms[index];
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                        title: Text(
                          form.title.isEmpty ? t.untitledForm : form.title,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          DateFormat.yMMMd().add_Hm().format(form.updatedAt),
                          style: TextStyle(color: FormiaColors.textMuted, fontSize: 12),
                        ),
                        onTap: () => context.push('/editor/${form.id}'),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete_outline),
                          tooltip: t.deleteForm,
                          onPressed: () async {
                            final confirmed = await showDialog<bool>(
                              context: context,
                              builder: (context) => AlertDialog(
                                title: Text(t.deleteForm),
                                content: Text(t.deleteFormConfirm),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.of(context).pop(false),
                                    child: Text(t.cancel),
                                  ),
                                  FilledButton(
                                    onPressed: () => Navigator.of(context).pop(true),
                                    child: Text(t.confirm),
                                  ),
                                ],
                              ),
                            );
                            if (confirmed == true) {
                              await ref.read(formsListControllerProvider.notifier).delete(form.id);
                            }
                          },
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
