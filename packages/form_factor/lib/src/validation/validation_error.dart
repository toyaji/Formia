/// A reportable issue found by [FormFactorValidator].
///
/// Unlike [FormFactorViolation] (thrown at construction for hard invariant
/// breaks), a [ValidationError] is *collected* — it may be surfaced in the
/// editor as a warning/error and can block save/deploy without preventing an
/// in-memory model from existing.
///
/// Messages are language-neutral: [code] is an i18n key and [params] carries
/// interpolation data; the UI layer renders the localized string
/// (see `docs/flutter_migration/01-form-factor-v3.md#7`).
library;

import 'package:meta/meta.dart';

enum ValidationSeverity { warning, error }

@immutable
class ValidationError {
  const ValidationError(
    this.code, {
    this.params = const {},
    this.severity = ValidationSeverity.error,
  });

  final String code;
  final Map<String, Object?> params;
  final ValidationSeverity severity;

  @override
  String toString() => 'ValidationError($severity, $code, $params)';

  @override
  bool operator ==(Object other) =>
      other is ValidationError &&
      other.code == code &&
      other.severity == severity;

  @override
  int get hashCode => Object.hash(code, severity);
}
