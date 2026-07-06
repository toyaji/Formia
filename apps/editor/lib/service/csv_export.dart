/// Triggers a CSV download (03 §6 response export). Web downloads a real
/// file; other platforms fall back to a stub (see `csv_export_stub.dart`) —
/// desktop file-save wiring is a later addition.
library;

export 'csv_export_stub.dart' if (dart.library.js_interop) 'csv_export_web.dart';
