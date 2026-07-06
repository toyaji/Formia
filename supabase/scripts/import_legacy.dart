// One-time legacy data import: Prisma/SQLite (v2 `Form.factor`) -> Supabase
// v3 schema, via `FormFactorMigrator` (packages/form_factor). See
// docs/flutter_migration/03-backend-supabase.md#7 and #05 Phase 7.
//
// Usage (from repo root, after `cd supabase/scripts && dart pub get`):
//   dart run supabase/scripts/import_legacy.dart \
//     --db ./dev.db \
//     --url http://127.0.0.1:54321 \
//     --service-key <SERVICE_ROLE_KEY> \
//     [--dry-run]
//
// `--url`/`--service-key` fall back to the SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY env vars. Never point this at production without
// first running with --dry-run and reviewing the report.
library;

import 'dart:convert';
import 'dart:io';

import 'package:args/args.dart';
import 'package:form_factor/form_factor.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

const _uuid = Uuid();

void main(List<String> arguments) async {
  final parser = ArgParser()
    ..addOption('db', defaultsTo: 'dev.db', help: 'Path to legacy sqlite db')
    ..addOption('url', help: 'Supabase URL (or SUPABASE_URL env)')
    ..addOption('service-key',
        help: 'Supabase service_role key (or SUPABASE_SERVICE_ROLE_KEY env)')
    ..addFlag('dry-run',
        help: 'Read and migrate only; do not write to Supabase',
        defaultsTo: false);
  final args = parser.parse(arguments);

  final dbPath = args['db'] as String;
  final url = (args['url'] as String?) ?? Platform.environment['SUPABASE_URL'];
  final serviceKey = (args['service-key'] as String?) ??
      Platform.environment['SUPABASE_SERVICE_ROLE_KEY'];
  final dryRun = args['dry-run'] as bool;

  if (!File(dbPath).existsSync()) {
    stderr.writeln('sqlite db not found: $dbPath');
    exitCode = 2;
    return;
  }
  if (url == null || serviceKey == null) {
    stderr.writeln(
        'Missing --url/--service-key (or SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY env).');
    exitCode = 2;
    return;
  }

  final importer = LegacyImporter(
    dbPath: dbPath,
    supabaseUrl: url,
    serviceKey: serviceKey,
    dryRun: dryRun,
  );
  final report = await importer.run();
  report.printSummary();
  await report.writeToFile();
  exitCode = report.hasFailures ? 1 : 0;
}

/// Runs one query against the legacy sqlite db via the `sqlite3` CLI and
/// parses the `-json` output. Avoids a native FFI dependency for a one-time
/// script (00-decisions ADR-8: don't add tooling weight we don't need).
Future<List<Map<String, dynamic>>> _querySqlite(String dbPath, String sql) async {
  final result = await Process.run('sqlite3', ['-json', dbPath, sql]);
  if (result.exitCode != 0) {
    throw StateError('sqlite3 query failed: ${result.stderr}');
  }
  final out = (result.stdout as String).trim();
  if (out.isEmpty) return const [];
  return (jsonDecode(out) as List).cast<Map<String, dynamic>>();
}

class ImportReport {
  final List<String> importedForms = [];
  final List<String> skippedDuplicateForms = [];
  final List<String> failedForms = [];
  final List<String> unmappedUsers = [];
  final List<String> repairedForms = [];
  final List<String> importedDeployments = [];
  final List<String> skippedDeployments = [];
  final List<String> importedResponses = [];
  final Map<String, List<String>> warningsByForm = {};

  bool get hasFailures => failedForms.isNotEmpty || unmappedUsers.isNotEmpty;

  void printSummary() {
    stdout.writeln('\n=== Legacy import report ===');
    stdout.writeln('Forms imported:      ${importedForms.length}');
    stdout.writeln('Forms repaired:      ${repairedForms.length} (missing ending page auto-appended)');
    stdout.writeln('Forms skipped (dup): ${skippedDuplicateForms.length}');
    stdout.writeln('Forms failed:        ${failedForms.length}');
    stdout.writeln('Users unmapped:      ${unmappedUsers.length} (no matching Supabase auth user by email)');
    stdout.writeln('Deployments imported:${importedDeployments.length}');
    stdout.writeln('Deployments skipped: ${skippedDeployments.length} (short_id conflict)');
    stdout.writeln('Responses imported:  ${importedResponses.length}');
    if (unmappedUsers.isNotEmpty) {
      stdout.writeln('\nUnmapped users (their forms were skipped):');
      for (final u in unmappedUsers) {
        stdout.writeln('  - $u');
      }
    }
    if (failedForms.isNotEmpty) {
      stdout.writeln('\nFailed forms:');
      for (final f in failedForms) {
        stdout.writeln('  - $f');
      }
    }
    if (warningsByForm.isNotEmpty) {
      stdout.writeln('\nMigration warnings (lossless: preserved as warnings, not dropped silently):');
      warningsByForm.forEach((formId, warnings) {
        stdout.writeln('  $formId:');
        for (final w in warnings) {
          stdout.writeln('    - $w');
        }
      });
    }
  }

  Future<void> writeToFile() async {
    final path =
        'supabase/scripts/import_report_${DateTime.now().toIso8601String().replaceAll(':', '-')}.json';
    final json = {
      'importedForms': importedForms,
      'repairedForms': repairedForms,
      'skippedDuplicateForms': skippedDuplicateForms,
      'failedForms': failedForms,
      'unmappedUsers': unmappedUsers,
      'importedDeployments': importedDeployments,
      'skippedDeployments': skippedDeployments,
      'importedResponses': importedResponses,
      'warningsByForm': warningsByForm,
    };
    try {
      await File(path).writeAsString(const JsonEncoder.withIndent('  ').convert(json));
      stdout.writeln('\nFull report written to $path');
    } on Object catch (e) {
      stderr.writeln('Could not write report file: $e');
    }
  }
}

class LegacyImporter {
  LegacyImporter({
    required this.dbPath,
    required this.supabaseUrl,
    required this.serviceKey,
    required this.dryRun,
  });

  final String dbPath;
  final String supabaseUrl;
  final String serviceKey;
  final bool dryRun;

  final _migrator = FormFactorMigrator();
  final _report = ImportReport();

  Map<String, String> get _headers => {
        'apikey': serviceKey,
        'Authorization': 'Bearer $serviceKey',
        'Content-Type': 'application/json',
      };

  Future<ImportReport> run() async {
    final users = await _querySqlite(dbPath, 'select id, email from User;');
    final ownerMap = await _resolveOwners(users);

    final forms = await _querySqlite(
        dbPath, 'select id, title, factor, ownerId, version from Form;');
    final formIdMap = <String, String>{}; // legacy Form.id -> new uuid

    for (final row in forms) {
      final legacyId = row['id'] as String;
      final title = row['title'] as String? ?? 'Untitled Form';
      final legacyOwnerId = row['ownerId'] as String;
      final ownerId = ownerMap[legacyOwnerId];
      if (ownerId == null) {
        // already recorded in unmappedUsers; just skip this form silently
        // (per-user note is enough context).
        continue;
      }

      Map<String, dynamic> v2Json;
      try {
        v2Json = jsonDecode(row['factor'] as String) as Map<String, dynamic>;
      } on Object catch (e) {
        _report.failedForms.add('$legacyId ($title): invalid factor JSON — $e');
        continue;
      }

      final migration = _migrator.migrate(v2Json);
      if (migration.warnings.isNotEmpty) {
        _report.warningsByForm[legacyId] =
            migration.warnings.map((w) => w.toString()).toList();
      }

      FormFactor factor;
      try {
        factor = FormFactor.fromJson(migration.json);
      } on FormFactorViolation catch (v) {
        if (v.code == 'pages.atLeastOneEnding' || v.code == 'pages.lastMustBeEnding') {
          try {
            final repaired = _appendDefaultEnding(migration.json);
            factor = FormFactor.fromJson(repaired);
            _report.repairedForms
                .add('$legacyId ($title): appended default ending page (${v.code})');
          } on Object catch (e2) {
            _report.failedForms.add('$legacyId ($title): repair failed — $e2');
            continue;
          }
        } else {
          _report.failedForms.add('$legacyId ($title): $v');
          continue;
        }
      }

      if (await _alreadyImported(ownerId, title, factor.metadata.createdAt)) {
        _report.skippedDuplicateForms.add('$legacyId ($title)');
        continue;
      }

      final legacyVersion = (row['version'] as num?)?.toInt() ?? 1;
      final newId = await _insertForm(
        ownerId: ownerId,
        title: title,
        factor: factor,
        version: legacyVersion,
      );
      if (newId == null) {
        _report.failedForms.add('$legacyId ($title): insert failed');
        continue;
      }
      formIdMap[legacyId] = newId;
      _report.importedForms.add('$legacyId -> $newId ($title)');
    }

    await _importDeployments(formIdMap);
    await _importResponses(formIdMap);

    return _report;
  }

  /// Matches legacy `User.email` to an existing Supabase auth user (accounts
  /// are recreated via OAuth re-login, not migrated — 03 §7). Unmatched users'
  /// forms are skipped and reported so they can be re-run once that user logs
  /// in.
  Future<Map<String, String>> _resolveOwners(
      List<Map<String, dynamic>> legacyUsers) async {
    final byEmail = <String, String>{};
    var page = 1;
    while (true) {
      final resp = await http.get(
        Uri.parse('$supabaseUrl/auth/v1/admin/users?page=$page&per_page=1000'),
        headers: _headers,
      );
      if (resp.statusCode != 200) {
        throw StateError(
            'Failed to list Supabase auth users: ${resp.statusCode} ${resp.body}');
      }
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      final users = (body['users'] as List).cast<Map<String, dynamic>>();
      for (final u in users) {
        final email = (u['email'] as String?)?.toLowerCase();
        if (email != null) byEmail[email] = u['id'] as String;
      }
      if (users.length < 1000) break;
      page++;
    }

    final ownerMap = <String, String>{};
    for (final u in legacyUsers) {
      final legacyId = u['id'] as String;
      final email = (u['email'] as String?)?.toLowerCase();
      final matched = email == null ? null : byEmail[email];
      if (matched == null) {
        _report.unmappedUsers.add('$legacyId <$email>');
      } else {
        ownerMap[legacyId] = matched;
      }
    }
    return ownerMap;
  }

  Map<String, dynamic> _appendDefaultEnding(Map<String, dynamic> v3Json) {
    final pages = (v3Json['pages'] as List).cast<Map<String, dynamic>>();
    return {
      ...v3Json,
      'pages': [
        ...pages,
        {
          'id': _uuid.v4(),
          'role': 'ending',
          'title': '제출이 완료되었습니다',
          'blocks': const <Map<String, dynamic>>[],
          'locked': true,
        },
      ],
    };
  }

  Future<bool> _alreadyImported(
      String ownerId, String title, String createdAt) async {
    if (dryRun) return false;
    final uri = Uri.parse(
        '$supabaseUrl/rest/v1/forms?owner_id=eq.$ownerId&title=eq.${Uri.encodeComponent(title)}&select=factor');
    final resp = await http.get(uri, headers: _headers);
    if (resp.statusCode != 200) return false;
    final rows = jsonDecode(resp.body) as List;
    for (final row in rows) {
      final factor = (row as Map<String, dynamic>)['factor'] as Map<String, dynamic>?;
      final existingCreatedAt =
          (factor?['metadata'] as Map<String, dynamic>?)?['createdAt'];
      if (existingCreatedAt == createdAt) return true;
    }
    return false;
  }

  Future<String?> _insertForm({
    required String ownerId,
    required String title,
    required FormFactor factor,
    required int version,
  }) async {
    if (dryRun) return _uuid.v4(); // fake id so downstream steps can be previewed
    final resp = await http.post(
      Uri.parse('$supabaseUrl/rest/v1/forms'),
      headers: {..._headers, 'Prefer': 'return=representation'},
      body: jsonEncode({
        'owner_id': ownerId,
        'title': title,
        'factor': factor.toJson(),
        'version': version,
      }),
    );
    if (resp.statusCode != 201) {
      stderr.writeln('Insert form failed: ${resp.statusCode} ${resp.body}');
      return null;
    }
    final rows = jsonDecode(resp.body) as List;
    return (rows.first as Map<String, dynamic>)['id'] as String;
  }

  Future<void> _importDeployments(Map<String, String> formIdMap) async {
    final deployments = await _querySqlite(dbPath,
        'select formId, status, shortId, publishedAt, settings from Deployment;');
    for (final row in deployments) {
      final legacyFormId = row['formId'] as String;
      final newFormId = formIdMap[legacyFormId];
      if (newFormId == null) continue; // form itself was skipped/failed

      final shortId = row['shortId'] as String?;
      if (shortId != null && !dryRun) {
        final check = await http.get(
          Uri.parse(
              '$supabaseUrl/rest/v1/deployments?short_id=eq.${Uri.encodeComponent(shortId)}&select=id'),
          headers: _headers,
        );
        if (check.statusCode == 200 &&
            (jsonDecode(check.body) as List).isNotEmpty) {
          _report.skippedDeployments.add('$legacyFormId ($shortId): short_id already taken');
          continue;
        }
      }

      if (dryRun) {
        _report.importedDeployments.add('$legacyFormId -> $newFormId (dry-run)');
        continue;
      }
      final settingsRaw = row['settings'] as String?;
      final resp = await http.post(
        Uri.parse('$supabaseUrl/rest/v1/deployments'),
        headers: {..._headers, 'Prefer': 'return=representation'},
        body: jsonEncode({
          'form_id': newFormId,
          'status': row['status'] ?? 'draft',
          'short_id': ?shortId,
          if (row['publishedAt'] != null) 'published_at': row['publishedAt'],
          if (settingsRaw != null) 'settings': jsonDecode(settingsRaw),
        }),
      );
      if (resp.statusCode == 201) {
        _report.importedDeployments.add('$legacyFormId -> $newFormId');
      } else {
        stderr.writeln('Insert deployment failed: ${resp.statusCode} ${resp.body}');
      }
    }
  }

  Future<void> _importResponses(Map<String, String> formIdMap) async {
    final responses = await _querySqlite(
        dbPath, 'select formId, data, metadata, submittedAt from Response;');
    for (final row in responses) {
      final legacyFormId = row['formId'] as String;
      final newFormId = formIdMap[legacyFormId];
      if (newFormId == null) continue;

      if (dryRun) {
        _report.importedResponses.add('$legacyFormId -> $newFormId (dry-run)');
        continue;
      }
      final metadataRaw = row['metadata'] as String?;
      final resp = await http.post(
        Uri.parse('$supabaseUrl/rest/v1/responses'),
        headers: {..._headers, 'Prefer': 'return=representation'},
        body: jsonEncode({
          'form_id': newFormId,
          'data': jsonDecode(row['data'] as String),
          if (metadataRaw != null) 'metadata': jsonDecode(metadataRaw),
          'submitted_at': row['submittedAt'],
        }),
      );
      if (resp.statusCode == 201) {
        _report.importedResponses.add('$legacyFormId -> $newFormId');
      } else {
        stderr.writeln('Insert response failed: ${resp.statusCode} ${resp.body}');
      }
    }
  }
}
