/// Form theme: color/mode tokens applied by both the editor preview and the
/// Jaspr public renderer (see `docs/flutter_migration/01-form-factor-v3.md#1`).
library;

import 'package:meta/meta.dart';

import 'enums.dart';

@immutable
class FormTheme {
  const FormTheme({this.mode = ThemeMode.light, this.tokens = const {}});

  final ThemeMode mode;

  /// Design tokens (e.g. `primary`, `background`, `surface`, `radius`) kept as
  /// an open map so the AI/editor can set arbitrary tokens without a model bump.
  final Map<String, String> tokens;

  FormTheme copyWith({ThemeMode? mode, Map<String, String>? tokens}) =>
      FormTheme(mode: mode ?? this.mode, tokens: tokens ?? this.tokens);

  factory FormTheme.fromJson(Map<String, dynamic> json) => FormTheme(
        mode: json['mode'] == null
            ? ThemeMode.light
            : ThemeMode.fromJson(json['mode'] as String),
        tokens: (json['tokens'] as Map<String, dynamic>?)
                ?.map((k, v) => MapEntry(k, v as String)) ??
            const {},
      );

  Map<String, dynamic> toJson() => {'mode': mode.toJson(), 'tokens': tokens};
}
