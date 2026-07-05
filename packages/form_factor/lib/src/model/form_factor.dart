/// The root Form Factor v3 aggregate and its structural invariants.
///
/// See `docs/flutter_migration/01-form-factor-v3.md#1` and `#1.1`.
library;

import 'package:meta/meta.dart';

import 'enums.dart';
import 'exceptions.dart';
import 'logic.dart';
import 'page.dart';
import 'theme.dart';

const String kSchemaVersion = '3.0.0';

/// Recursively coerces `Map<dynamic, dynamic>` (as produced by hive and some
/// non-`jsonDecode` sources) into `Map<String, dynamic>` so nested `fromJson`
/// casts are safe regardless of the JSON source.
Map<String, dynamic> normalizeJsonMap(Map<dynamic, dynamic> input) =>
    input.map((k, v) => MapEntry(k.toString(), _normalizeJsonValue(v)));

Object? _normalizeJsonValue(Object? v) {
  if (v is Map) return normalizeJsonMap(v);
  if (v is List) return v.map(_normalizeJsonValue).toList();
  return v;
}

@immutable
class FormMetadata {
  const FormMetadata({
    required this.title,
    this.description,
    required this.createdAt,
    required this.updatedAt,
  });

  final String title;
  final String? description;
  final String createdAt; // ISO-8601
  final String updatedAt; // ISO-8601

  FormMetadata copyWith({
    String? title,
    String? description,
    String? createdAt,
    String? updatedAt,
  }) =>
      FormMetadata(
        title: title ?? this.title,
        description: description ?? this.description,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );

  factory FormMetadata.fromJson(Map<String, dynamic> json) => FormMetadata(
        title: json['title'] as String,
        description: json['description'] as String?,
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
      );

  Map<String, dynamic> toJson() => {
        'title': title,
        if (description != null) 'description': description,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };
}

@immutable
class FormSettings {
  const FormSettings({
    this.submitButtonLabel = '제출하기',
    this.successMessage = '성공적으로 제출되었습니다.',
  });

  final String submitButtonLabel;
  final String successMessage;

  FormSettings copyWith({String? submitButtonLabel, String? successMessage}) =>
      FormSettings(
        submitButtonLabel: submitButtonLabel ?? this.submitButtonLabel,
        successMessage: successMessage ?? this.successMessage,
      );

  factory FormSettings.fromJson(Map<String, dynamic> json) => FormSettings(
        submitButtonLabel: json['submitButtonLabel'] as String? ?? '제출하기',
        successMessage:
            json['successMessage'] as String? ?? '성공적으로 제출되었습니다.',
      );

  Map<String, dynamic> toJson() => {
        'submitButtonLabel': submitButtonLabel,
        'successMessage': successMessage,
      };
}

@immutable
class FormFactor {
  /// Creates a validated Form Factor. Throws [FormFactorViolation] if the page
  /// list breaks the structural invariants (§1.1).
  factory FormFactor({
    String schemaVersion = kSchemaVersion,
    required FormMetadata metadata,
    FormTheme theme = const FormTheme(),
    required List<FormPage> pages,
    FormLogic logic = const FormLogic(),
    FormSettings settings = const FormSettings(),
  }) {
    _checkInvariants(pages);
    return FormFactor._(
      schemaVersion: schemaVersion,
      metadata: metadata,
      theme: theme,
      pages: List.unmodifiable(pages),
      logic: logic,
      settings: settings,
    );
  }

  const FormFactor._({
    required this.schemaVersion,
    required this.metadata,
    required this.theme,
    required this.pages,
    required this.logic,
    required this.settings,
  });

  final String schemaVersion;
  final FormMetadata metadata;
  final FormTheme theme;
  final List<FormPage> pages;
  final FormLogic logic;
  final FormSettings settings;

  /// Enforces the page-list invariants (§1.1):
  /// exactly one leading `start`, >=1 trailing `ending`, middle all `question`,
  /// unique page & block ids.
  static void _checkInvariants(List<FormPage> pages) {
    if (pages.isEmpty) {
      throw const FormFactorViolation('pages.empty');
    }
    if (pages.first.role != PageRole.start) {
      throw const FormFactorViolation('pages.firstMustBeStart');
    }
    if (pages.where((p) => p.role == PageRole.start).length != 1) {
      throw const FormFactorViolation('pages.exactlyOneStart');
    }
    if (pages.last.role != PageRole.ending) {
      throw const FormFactorViolation('pages.lastMustBeEnding');
    }
    if (!pages.any((p) => p.role == PageRole.ending)) {
      throw const FormFactorViolation('pages.atLeastOneEnding');
    }
    // Middle pages (between first start and last ending) must not be `start`;
    // they are `question` or additional `ending` (early-exit) pages.
    for (var i = 1; i < pages.length - 1; i++) {
      if (pages[i].role == PageRole.start) {
        throw const FormFactorViolation('pages.startMustBeFirst');
      }
    }

    final pageIds = <String>{};
    final blockIds = <String>{};
    for (final page in pages) {
      if (!pageIds.add(page.id)) {
        throw FormFactorViolation('pages.duplicateId', {'id': page.id});
      }
      for (final block in page.blocks) {
        if (!blockIds.add(block.id)) {
          throw FormFactorViolation('blocks.duplicateId', {'id': block.id});
        }
      }
    }
  }

  FormFactor copyWith({
    String? schemaVersion,
    FormMetadata? metadata,
    FormTheme? theme,
    List<FormPage>? pages,
    FormLogic? logic,
    FormSettings? settings,
  }) =>
      FormFactor(
        schemaVersion: schemaVersion ?? this.schemaVersion,
        metadata: metadata ?? this.metadata,
        theme: theme ?? this.theme,
        pages: pages ?? this.pages,
        logic: logic ?? this.logic,
        settings: settings ?? this.settings,
      );

  factory FormFactor.fromJson(Map<dynamic, dynamic> raw) {
    final json = normalizeJsonMap(raw);
    return FormFactor(
      schemaVersion: json['schemaVersion'] as String? ?? kSchemaVersion,
      metadata: FormMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
      theme: json['theme'] == null
          ? const FormTheme()
          : FormTheme.fromJson(json['theme'] as Map<String, dynamic>),
      pages: (json['pages'] as List<dynamic>)
          .map((e) => FormPage.fromJson(e as Map<String, dynamic>))
          .toList(),
      logic: json['logic'] == null
          ? const FormLogic()
          : FormLogic.fromJson(json['logic'] as Map<String, dynamic>),
      settings: json['settings'] == null
          ? const FormSettings()
          : FormSettings.fromJson(json['settings'] as Map<String, dynamic>),
    );
  }

  Map<String, dynamic> toJson() => {
        'schemaVersion': schemaVersion,
        'metadata': metadata.toJson(),
        'theme': theme.toJson(),
        'pages': pages.map((e) => e.toJson()).toList(),
        'logic': logic.toJson(),
        'settings': settings.toJson(),
      };
}
