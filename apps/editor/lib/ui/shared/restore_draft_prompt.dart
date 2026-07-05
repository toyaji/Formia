import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';

/// Explicit restore-vs-fresh prompt for guest local drafts (02 §5): no
/// auto-restore. Returns `true` if the user chose to restore, `false` to
/// start fresh, or `null` if dismissed (treated as "keep as-is").
Future<bool?> showRestoreDraftPrompt(BuildContext context) {
  final t = AppLocalizations.of(context)!;
  return showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(t.restoreDraftTitle),
      content: Text(t.restoreDraftBody),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(t.restoreDraftDiscard),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(t.restoreDraftRestore),
        ),
      ],
    ),
  );
}
