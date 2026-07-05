/// Migrates legacy Form Factor JSON to v3. **Lossless**: any field without an
/// explicit v3 home is recorded as a [MigrationWarning] rather than silently
/// dropped (see `docs/flutter_migration/01-form-factor-v3.md#4`, `#4.1`).
library;

import 'package:meta/meta.dart';
import 'package:uuid/uuid.dart';

import '../model/form_factor.dart';

@immutable
class MigrationWarning {
  const MigrationWarning(this.path, this.reason, this.value);

  /// Where the unmapped data lived, e.g. `pages[1].blocks[0].content.foo`.
  final String path;

  /// A stable reason code (i18n key), e.g. `content.unmappedField`.
  final String reason;

  /// The dropped/quarantined value, preserved for inspection.
  final Object? value;

  @override
  String toString() => 'MigrationWarning($path, $reason, $value)';
}

@immutable
class MigrationResult {
  const MigrationResult(this.json, this.warnings);

  /// v3-shaped JSON (feed to [FormFactor.fromJson]).
  final Map<String, dynamic> json;
  final List<MigrationWarning> warnings;

  bool get isLossless => warnings.isEmpty;
}

class FormFactorMigrator {
  FormFactorMigrator({Uuid? uuid}) : _uuid = uuid ?? const Uuid();

  final Uuid _uuid;

  static const _metaKeys = {'title', 'description', 'createdAt', 'updatedAt'};
  static const _contentKeys = <String, Set<String>>{
    'text': {'label', 'placeholder', 'helpText'},
    'textarea': {'label', 'placeholder', 'helpText'},
    'choice': {'label', 'options', 'multiSelect', 'allowOther', 'helpText'},
    'rating': {'label', 'maxRating'},
    'date': {'label'},
    'file': {'label'},
    'info': {'body'},
    'statement': {'label', 'body'},
  };

  /// Migrates [json] from its declared version to v3.
  MigrationResult migrate(Map<String, dynamic> json) {
    final version =
        (json['schemaVersion'] ?? json['version'] ?? '2.0.0').toString();
    if (version.startsWith('3')) {
      return MigrationResult(Map<String, dynamic>.from(json), const []);
    }
    return _migrateV2ToV3(json);
  }

  /// Convenience: migrate and parse into a validated [FormFactor].
  ({FormFactor factor, List<MigrationWarning> warnings}) migrateToFactor(
      Map<String, dynamic> json) {
    final result = migrate(json);
    return (factor: FormFactor.fromJson(result.json), warnings: result.warnings);
  }

  MigrationResult _migrateV2ToV3(Map<String, dynamic> v2) {
    final warnings = <MigrationWarning>[];

    // metadata
    final v2meta = (v2['metadata'] as Map?)?.cast<String, dynamic>() ?? {};
    _warnUnknownKeys(v2meta, _metaKeys, 'metadata', warnings);
    final metadata = {
      'title': v2meta['title'] ?? 'Untitled Form',
      if (v2meta['description'] != null) 'description': v2meta['description'],
      'createdAt': v2meta['createdAt'] ?? DateTime.now().toIso8601String(),
      'updatedAt': v2meta['updatedAt'] ?? DateTime.now().toIso8601String(),
    };

    // theme
    final v2theme = (v2['theme'] as Map?)?.cast<String, dynamic>() ?? {};
    _warnUnknownKeys(v2theme, {'mode', 'tokens'}, 'theme', warnings);

    // pages: object -> ordered list
    final v2pages = (v2['pages'] as Map?)?.cast<String, dynamic>() ?? {};
    _warnUnknownKeys(
        v2pages, {'start', 'questions', 'endings'}, 'pages', warnings);

    final pages = <Map<String, dynamic>>[];
    var pageIdx = 0;

    if (v2pages['start'] != null) {
      pages.add(_migratePage(
          (v2pages['start'] as Map).cast<String, dynamic>(),
          role: 'start',
          locked: true,
          path: 'pages.start',
          warnings: warnings));
    }
    for (final q in (v2pages['questions'] as List? ?? const [])) {
      pages.add(_migratePage((q as Map).cast<String, dynamic>(),
          role: 'question',
          locked: false,
          path: 'pages.questions[${pageIdx++}]',
          warnings: warnings));
    }
    final endings =
        (v2pages['endings'] as List? ?? const []).cast<dynamic>();
    for (var i = 0; i < endings.length; i++) {
      final isPrimary = i == endings.length - 1; // last ending = primary
      pages.add(_migratePage((endings[i] as Map).cast<String, dynamic>(),
          role: 'ending',
          locked: isPrimary,
          path: 'pages.endings[$i]',
          warnings: warnings));
    }

    final v3 = <String, dynamic>{
      'schemaVersion': kSchemaVersion,
      'metadata': metadata,
      'theme': {
        'mode': v2theme['mode'] ?? 'light',
        'tokens': (v2theme['tokens'] as Map?)?.cast<String, dynamic>() ?? {},
      },
      'pages': pages,
      'logic': {'rules': []},
      if (v2['settings'] != null) 'settings': v2['settings'],
    };
    _warnUnknownKeys(
        v2,
        {'version', 'schemaVersion', 'metadata', 'theme', 'pages', 'settings'},
        '',
        warnings);
    return MigrationResult(v3, warnings);
  }

  Map<String, dynamic> _migratePage(
    Map<String, dynamic> v2page, {
    required String role,
    required bool locked,
    required String path,
    required List<MigrationWarning> warnings,
  }) {
    _warnUnknownKeys(v2page,
        {'id', 'type', 'title', 'description', 'blocks', 'removable'}, path,
        warnings);
    final blocks = <Map<String, dynamic>>[];
    final v2blocks = (v2page['blocks'] as List? ?? const []);
    for (var i = 0; i < v2blocks.length; i++) {
      blocks.add(_migrateBlock((v2blocks[i] as Map).cast<String, dynamic>(),
          path: '$path.blocks[$i]', warnings: warnings));
    }
    return {
      'id': v2page['id'] ?? _uuid.v4(),
      'role': role,
      'title': v2page['title'] ?? '',
      if (v2page['description'] != null) 'description': v2page['description'],
      'blocks': blocks,
      'locked': locked,
    };
  }

  Map<String, dynamic> _migrateBlock(
    Map<String, dynamic> v2block, {
    required String path,
    required List<MigrationWarning> warnings,
  }) {
    _warnUnknownKeys(v2block,
        {'id', 'type', 'content', 'validation', 'style', 'removable'}, path,
        warnings);
    final type = v2block['type'] as String?;
    final v2content =
        (v2block['content'] as Map?)?.cast<String, dynamic>() ?? {};
    final content = _migrateContent(type, v2content,
        path: '$path.content', warnings: warnings);
    return {
      'id': v2block['id'] ?? _uuid.v4(),
      'content': content,
      if (v2block['validation'] != null) 'validation': v2block['validation'],
      if (v2block['style'] != null) 'style': v2block['style'],
      'removable': v2block['removable'] ?? true,
    };
  }

  Map<String, dynamic> _migrateContent(
    String? type,
    Map<String, dynamic> c, {
    required String path,
    required List<MigrationWarning> warnings,
  }) {
    final known = _contentKeys[type];
    if (type == null || known == null) {
      warnings.add(MigrationWarning(path, 'block.unknownType', {
        'type': type,
        'content': c,
      }));
      // Preserve textual content losslessly as a statement.
      return {
        'type': 'statement',
        if (c['label'] != null) 'label': c['label'],
        if (c['body'] != null) 'body': c['body'],
      };
    }
    _warnUnknownKeys(c, known, path, warnings);

    switch (type) {
      case 'choice':
        final options = (c['options'] as List? ?? const [])
            .map((o) => {'id': _uuid.v4(), 'label': o.toString()})
            .toList();
        return {
          'type': 'choice',
          'label': c['label'] ?? '',
          'options': options,
          'multiSelect': c['multiSelect'] ?? false,
          'allowOther': c['allowOther'] ?? false,
          if (c['helpText'] != null) 'helpText': c['helpText'],
        };
      case 'rating':
        return {
          'type': 'rating',
          'label': c['label'] ?? '',
          'maxRating': c['maxRating'] ?? 5,
          'style': 'star',
        };
      case 'date':
        return {'type': 'date', 'label': c['label'] ?? '', 'includeTime': false};
      case 'file':
        return {
          'type': 'file',
          'label': c['label'] ?? '',
          'acceptedTypes': <String>[],
          'maxSizeMb': 10,
        };
      case 'info':
        return {'type': 'info', 'body': c['body'] ?? ''};
      case 'statement':
        return {
          'type': 'statement',
          if (c['label'] != null) 'label': c['label'],
          if (c['body'] != null) 'body': c['body'],
        };
      default: // text, textarea
        return {
          'type': type,
          'label': c['label'] ?? '',
          if (c['placeholder'] != null) 'placeholder': c['placeholder'],
          if (c['helpText'] != null) 'helpText': c['helpText'],
        };
    }
  }

  void _warnUnknownKeys(Map<String, dynamic> map, Set<String> known,
      String path, List<MigrationWarning> warnings) {
    for (final key in map.keys) {
      if (!known.contains(key)) {
        warnings.add(MigrationWarning(
            path.isEmpty ? key : '$path.$key', 'unmappedField', map[key]));
      }
    }
  }
}
