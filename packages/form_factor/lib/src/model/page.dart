/// A page within a form. Ordering/role invariants are enforced at the
/// [FormFactor] level (see `docs/flutter_migration/01-form-factor-v3.md#1.1`).
library;

import 'package:meta/meta.dart';

import 'block.dart';
import 'enums.dart';

@immutable
class FormPage {
  const FormPage({
    required this.id,
    required this.role,
    required this.title,
    this.description,
    this.blocks = const [],
    this.locked = false,
  });

  final String id;
  final PageRole role;
  final String title;
  final String? description;
  final List<FormBlock> blocks;

  /// `true` for the start page and the primary ending page (cannot be
  /// deleted, moved, or renamed by the user/AI).
  final bool locked;

  FormPage copyWith({
    String? id,
    PageRole? role,
    String? title,
    String? description,
    List<FormBlock>? blocks,
    bool? locked,
  }) =>
      FormPage(
        id: id ?? this.id,
        role: role ?? this.role,
        title: title ?? this.title,
        description: description ?? this.description,
        blocks: blocks ?? this.blocks,
        locked: locked ?? this.locked,
      );

  factory FormPage.fromJson(Map<String, dynamic> json) => FormPage(
        id: json['id'] as String,
        role: PageRole.fromJson(json['role'] as String),
        title: json['title'] as String,
        description: json['description'] as String?,
        blocks: (json['blocks'] as List<dynamic>?)
                ?.map((e) => FormBlock.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
        locked: json['locked'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': role.toJson(),
        'title': title,
        if (description != null) 'description': description,
        'blocks': blocks.map((e) => e.toJson()).toList(),
        'locked': locked,
      };
}
