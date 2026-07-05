import 'package:form_factor/form_factor.dart';
import 'package:formia_core/formia_core.dart';
import 'package:supabase/supabase.dart';

import '../exceptions.dart';
import '../ports/form_repository.dart';

/// [FormRepository] backed by Supabase Postgres. Row-level security enforces
/// that a user only ever sees/edits their own forms, so this class does not
/// re-check ownership (fixes the legacy scattered checks).
class SupabaseFormRepository implements FormRepository {
  SupabaseFormRepository(this._client);

  final SupabaseClient _client;

  String? get _uid => _client.auth.currentUser?.id;

  @override
  Future<Result<String>> create(FormFactor factor) async {
    final uid = _uid;
    if (uid == null) return const Result.error(NotAuthenticatedException());
    try {
      final row = await _client
          .from('forms')
          .insert({
            'owner_id': uid,
            'title': factor.metadata.title,
            'factor': factor.toJson(),
          })
          .select('id')
          .single();
      return Result.ok(row['id'] as String);
    } on Object catch (e) {
      return Result.error(DataException('create_failed', cause: e));
    }
  }

  @override
  Future<Result<void>> save(String id, FormFactor factor) async {
    try {
      await _client.from('forms').update({
        'title': factor.metadata.title,
        'factor': factor.toJson(),
      }).eq('id', id);
      return const Result.ok(null);
    } on Object catch (e) {
      return Result.error(DataException('save_failed', cause: e));
    }
  }

  @override
  Future<Result<FormFactor>> load(String id) async {
    try {
      final row =
          await _client.from('forms').select('factor').eq('id', id).single();
      return Result.ok(FormFactor.fromJson(row['factor'] as Map));
    } on Object catch (e) {
      return Result.error(DataException('load_failed', cause: e));
    }
  }

  @override
  Future<Result<List<FormInfo>>> list() async {
    try {
      final rows = await _client
          .from('forms')
          .select('id, title, updated_at, deployments(status, short_id)')
          .order('updated_at', ascending: false);
      final infos = (rows as List).map((r) {
        final m = r as Map<String, dynamic>;
        final dep = _firstDeployment(m['deployments']);
        return FormInfo(
          id: m['id'] as String,
          title: m['title'] as String,
          updatedAt: DateTime.parse(m['updated_at'] as String),
          deployment: dep,
        );
      }).toList();
      return Result.ok(infos);
    } on Object catch (e) {
      return Result.error(DataException('list_failed', cause: e));
    }
  }

  @override
  Future<Result<void>> delete(String id) async {
    try {
      await _client.from('forms').delete().eq('id', id);
      return const Result.ok(null);
    } on Object catch (e) {
      return Result.error(DataException('delete_failed', cause: e));
    }
  }

  DeploymentInfo? _firstDeployment(Object? embedded) {
    // Supabase returns an embedded to-one as a Map or a single-element list.
    Map? m;
    if (embedded is List && embedded.isNotEmpty) m = embedded.first as Map;
    if (embedded is Map) m = embedded;
    if (m == null) return null;
    return DeploymentInfo(
      status: m['status'] as String,
      shortId: m['short_id'] as String?,
    );
  }
}
