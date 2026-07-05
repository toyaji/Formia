/// A single form block: typed [content] plus validation/style metadata.
///
/// See `docs/flutter_migration/01-form-factor-v3.md#2`.
library;

import 'package:meta/meta.dart';

import 'block_content.dart';

@immutable
class BlockValidation {
  const BlockValidation({this.required = false, this.pattern});

  final bool required;
  final String? pattern;

  BlockValidation copyWith({bool? required, String? pattern}) =>
      BlockValidation(
        required: required ?? this.required,
        pattern: pattern ?? this.pattern,
      );

  factory BlockValidation.fromJson(Map<String, dynamic> json) =>
      BlockValidation(
        required: json['required'] as bool? ?? false,
        pattern: json['pattern'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'required': required,
        if (pattern != null) 'pattern': pattern,
      };
}

@immutable
class FormBlock {
  const FormBlock({
    required this.id,
    required this.content,
    this.validation = const BlockValidation(),
    this.style = const {},
    this.removable = true,
  });

  final String id;
  final BlockContent content;
  final BlockValidation validation;
  final Map<String, Object?> style;
  final bool removable;

  FormBlock copyWith({
    String? id,
    BlockContent? content,
    BlockValidation? validation,
    Map<String, Object?>? style,
    bool? removable,
  }) =>
      FormBlock(
        id: id ?? this.id,
        content: content ?? this.content,
        validation: validation ?? this.validation,
        style: style ?? this.style,
        removable: removable ?? this.removable,
      );

  factory FormBlock.fromJson(Map<String, dynamic> json) => FormBlock(
        id: json['id'] as String,
        content:
            BlockContent.fromJson(json['content'] as Map<String, dynamic>),
        validation: json['validation'] == null
            ? const BlockValidation()
            : BlockValidation.fromJson(
                json['validation'] as Map<String, dynamic>),
        style: (json['style'] as Map<String, dynamic>?) ?? const {},
        removable: json['removable'] as bool? ?? true,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'content': content.toJson(),
        'validation': validation.toJson(),
        'style': style,
        'removable': removable,
      };
}
