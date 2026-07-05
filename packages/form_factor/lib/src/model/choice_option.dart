/// An option within a [ChoiceContent] block.
///
/// Carries a stable [id] so that logic rules can reference a specific option
/// independently of its label or position (see
/// `docs/flutter_migration/01-form-factor-v3.md#2`).
library;

import 'package:meta/meta.dart';

@immutable
class ChoiceOption {
  const ChoiceOption({required this.id, required this.label});

  final String id;
  final String label;

  ChoiceOption copyWith({String? id, String? label}) =>
      ChoiceOption(id: id ?? this.id, label: label ?? this.label);

  factory ChoiceOption.fromJson(Map<String, dynamic> json) => ChoiceOption(
        id: json['id'] as String,
        label: json['label'] as String,
      );

  Map<String, dynamic> toJson() => {'id': id, 'label': label};
}
