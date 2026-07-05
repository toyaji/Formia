/// The typed content of a [FormBlock], modelled as a sealed hierarchy so that
/// renderers (Flutter editor + Jaspr public form) get compile-time
/// exhaustiveness across every block type.
///
/// Serialization uses a `type` discriminator with hand-written dispatch — no
/// codegen (see `docs/flutter_migration/01-form-factor-v3.md#2` and ADR-8).
library;

import 'package:meta/meta.dart';

import 'choice_option.dart';
import 'enums.dart';
import 'exceptions.dart';

@immutable
sealed class BlockContent {
  const BlockContent();

  /// Stable discriminator written into JSON and matched by [fromJson].
  String get type;

  Map<String, dynamic> toJson();

  /// Dispatches on the `type` field to the matching subclass.
  factory BlockContent.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String?;
    switch (type) {
      case 'text':
        return TextContent.fromJson(json);
      case 'textarea':
        return TextAreaContent.fromJson(json);
      case 'choice':
        return ChoiceContent.fromJson(json);
      case 'rating':
        return RatingContent.fromJson(json);
      case 'date':
        return DateContent.fromJson(json);
      case 'file':
        return FileContent.fromJson(json);
      case 'info':
        return InfoContent.fromJson(json);
      case 'statement':
        return StatementContent.fromJson(json);
      default:
        throw FormFactorViolation(
          'block.content.unknownType',
          {'type': type},
        );
    }
  }
}

@immutable
class TextContent extends BlockContent {
  const TextContent({required this.label, this.placeholder, this.helpText});

  final String label;
  final String? placeholder;
  final String? helpText;

  @override
  String get type => 'text';

  TextContent copyWith({String? label, String? placeholder, String? helpText}) =>
      TextContent(
        label: label ?? this.label,
        placeholder: placeholder ?? this.placeholder,
        helpText: helpText ?? this.helpText,
      );

  factory TextContent.fromJson(Map<String, dynamic> json) => TextContent(
        label: json['label'] as String,
        placeholder: json['placeholder'] as String?,
        helpText: json['helpText'] as String?,
      );

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        'label': label,
        if (placeholder != null) 'placeholder': placeholder,
        if (helpText != null) 'helpText': helpText,
      };
}

@immutable
class TextAreaContent extends BlockContent {
  const TextAreaContent({required this.label, this.placeholder, this.helpText});

  final String label;
  final String? placeholder;
  final String? helpText;

  @override
  String get type => 'textarea';

  TextAreaContent copyWith({
    String? label,
    String? placeholder,
    String? helpText,
  }) =>
      TextAreaContent(
        label: label ?? this.label,
        placeholder: placeholder ?? this.placeholder,
        helpText: helpText ?? this.helpText,
      );

  factory TextAreaContent.fromJson(Map<String, dynamic> json) =>
      TextAreaContent(
        label: json['label'] as String,
        placeholder: json['placeholder'] as String?,
        helpText: json['helpText'] as String?,
      );

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        'label': label,
        if (placeholder != null) 'placeholder': placeholder,
        if (helpText != null) 'helpText': helpText,
      };
}

@immutable
class ChoiceContent extends BlockContent {
  const ChoiceContent({
    required this.label,
    required this.options,
    this.multiSelect = false,
    this.allowOther = false,
    this.helpText,
  });

  final String label;
  final List<ChoiceOption> options;
  final bool multiSelect;
  final bool allowOther;
  final String? helpText;

  @override
  String get type => 'choice';

  ChoiceContent copyWith({
    String? label,
    List<ChoiceOption>? options,
    bool? multiSelect,
    bool? allowOther,
    String? helpText,
  }) =>
      ChoiceContent(
        label: label ?? this.label,
        options: options ?? this.options,
        multiSelect: multiSelect ?? this.multiSelect,
        allowOther: allowOther ?? this.allowOther,
        helpText: helpText ?? this.helpText,
      );

  factory ChoiceContent.fromJson(Map<String, dynamic> json) => ChoiceContent(
        label: json['label'] as String,
        options: (json['options'] as List<dynamic>)
            .map((e) => ChoiceOption.fromJson(e as Map<String, dynamic>))
            .toList(),
        multiSelect: json['multiSelect'] as bool? ?? false,
        allowOther: json['allowOther'] as bool? ?? false,
        helpText: json['helpText'] as String?,
      );

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        'label': label,
        'options': options.map((e) => e.toJson()).toList(),
        'multiSelect': multiSelect,
        'allowOther': allowOther,
        if (helpText != null) 'helpText': helpText,
      };
}

@immutable
class RatingContent extends BlockContent {
  const RatingContent({
    required this.label,
    this.maxRating = 5,
    this.style = RatingStyle.star,
  });

  final String label;
  final int maxRating;
  final RatingStyle style;

  @override
  String get type => 'rating';

  RatingContent copyWith({String? label, int? maxRating, RatingStyle? style}) =>
      RatingContent(
        label: label ?? this.label,
        maxRating: maxRating ?? this.maxRating,
        style: style ?? this.style,
      );

  factory RatingContent.fromJson(Map<String, dynamic> json) => RatingContent(
        label: json['label'] as String,
        maxRating: json['maxRating'] as int? ?? 5,
        style: json['style'] == null
            ? RatingStyle.star
            : RatingStyle.fromJson(json['style'] as String),
      );

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        'label': label,
        'maxRating': maxRating,
        'style': style.toJson(),
      };
}

@immutable
class DateContent extends BlockContent {
  const DateContent({required this.label, this.includeTime = false});

  final String label;
  final bool includeTime;

  @override
  String get type => 'date';

  DateContent copyWith({String? label, bool? includeTime}) => DateContent(
        label: label ?? this.label,
        includeTime: includeTime ?? this.includeTime,
      );

  factory DateContent.fromJson(Map<String, dynamic> json) => DateContent(
        label: json['label'] as String,
        includeTime: json['includeTime'] as bool? ?? false,
      );

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        'label': label,
        'includeTime': includeTime,
      };
}

@immutable
class FileContent extends BlockContent {
  const FileContent({
    required this.label,
    this.acceptedTypes = const [],
    this.maxSizeMb = 10,
  });

  final String label;
  final List<String> acceptedTypes;
  final int maxSizeMb;

  @override
  String get type => 'file';

  FileContent copyWith({
    String? label,
    List<String>? acceptedTypes,
    int? maxSizeMb,
  }) =>
      FileContent(
        label: label ?? this.label,
        acceptedTypes: acceptedTypes ?? this.acceptedTypes,
        maxSizeMb: maxSizeMb ?? this.maxSizeMb,
      );

  factory FileContent.fromJson(Map<String, dynamic> json) => FileContent(
        label: json['label'] as String,
        acceptedTypes: (json['acceptedTypes'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            const [],
        maxSizeMb: json['maxSizeMb'] as int? ?? 10,
      );

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        'label': label,
        'acceptedTypes': acceptedTypes,
        'maxSizeMb': maxSizeMb,
      };
}

@immutable
class InfoContent extends BlockContent {
  const InfoContent({required this.body});

  final String body;

  @override
  String get type => 'info';

  InfoContent copyWith({String? body}) => InfoContent(body: body ?? this.body);

  factory InfoContent.fromJson(Map<String, dynamic> json) =>
      InfoContent(body: json['body'] as String);

  @override
  Map<String, dynamic> toJson() => {'type': type, 'body': body};
}

@immutable
class StatementContent extends BlockContent {
  const StatementContent({this.label, this.body});

  final String? label;
  final String? body;

  @override
  String get type => 'statement';

  StatementContent copyWith({String? label, String? body}) => StatementContent(
        label: label ?? this.label,
        body: body ?? this.body,
      );

  factory StatementContent.fromJson(Map<String, dynamic> json) =>
      StatementContent(
        label: json['label'] as String?,
        body: json['body'] as String?,
      );

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        if (label != null) 'label': label,
        if (body != null) 'body': body,
      };
}
