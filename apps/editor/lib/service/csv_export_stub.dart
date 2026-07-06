import 'dart:async';

import 'package:flutter/services.dart';

/// Desktop fallback: no filesystem-write UX wired up yet (Phase 3's
/// `DesktopFileRepository` gap), so copy the CSV to the clipboard instead of
/// silently doing nothing.
void downloadCsv(String filename, String csvContent) {
  unawaited(Clipboard.setData(ClipboardData(text: csvContent)));
}
