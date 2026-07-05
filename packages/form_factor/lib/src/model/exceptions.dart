/// Exceptions thrown when the domain model's structural invariants are
/// violated at construction time.
///
/// Per `docs/flutter_migration/01-form-factor-v3.md#1.1`, page-list
/// invariants must always hold; the constructors of [FormFactor] enforce
/// this by throwing [FormFactorViolation] rather than allowing an invalid
/// instance to exist.
///
/// This is distinct from [ValidationError] (see `validation/validation_error.dart`)
/// which is used by [FormFactorValidator] for *reportable* issues (dangling
/// references, graph reachability, etc.) that do not prevent construction of
/// an in-memory model but should block save/deploy.
class FormFactorViolation implements Exception {
  const FormFactorViolation(this.code, [this.params = const {}]);

  /// A stable, language-neutral identifier for the violation (i18n key).
  final String code;

  /// Structured parameters for message interpolation by the UI layer.
  final Map<String, Object?> params;

  @override
  String toString() => 'FormFactorViolation($code, $params)';
}
