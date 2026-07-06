import 'dart:js_interop';

import 'package:web/web.dart' as web;

void downloadCsv(String filename, String csvContent) {
  // Prepend a UTF-8 BOM so Excel opens Korean text correctly.
  final blob = web.Blob(
    ['﻿$csvContent'.toJS].toJS,
    web.BlobPropertyBag(type: 'text/csv;charset=utf-8'),
  );
  final url = web.URL.createObjectURL(blob);
  final anchor = web.HTMLAnchorElement()
    ..href = url
    ..download = filename
    ..style.display = 'none';
  web.document.body!.appendChild(anchor);
  anchor.click();
  anchor.remove();
  web.URL.revokeObjectURL(url);
}
