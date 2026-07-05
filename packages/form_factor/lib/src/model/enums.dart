/// Shared enums for the Form Factor v3 domain model.
library;

/// The structural role of a [FormPage] within a [FormFactor].
///
/// See `docs/flutter_migration/01-form-factor-v3.md#1.1` for the page
/// invariants enforced around these roles.
enum PageRole {
  start,
  question,
  ending;

  static PageRole fromJson(String value) => PageRole.values.byName(value);

  String toJson() => name;
}

/// Visual style for a [RatingContent] block.
enum RatingStyle {
  star,
  number,
  emoji;

  static RatingStyle fromJson(String value) => RatingStyle.values.byName(value);

  String toJson() => name;
}

/// Theme mode for a [FormTheme].
enum ThemeMode {
  light,
  dark,
  system;

  static ThemeMode fromJson(String value) => ThemeMode.values.byName(value);

  String toJson() => name;
}

/// Comparison operator used by [BlockAnswerCondition].
enum ConditionOperator {
  equals,
  notEquals,
  contains,
  gt,
  lt,
  isEmpty,
  isNotEmpty;

  static ConditionOperator fromJson(String value) =>
      ConditionOperator.values.byName(value);

  String toJson() => name;
}
