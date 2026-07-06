import 'dart:math';

import 'package:formia_core/formia_core.dart';
import 'package:supabase/supabase.dart';

import '../exceptions.dart';
import '../ports/deployment_repository.dart';

const _shortIdAlphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

String _generateShortId([int length = 8]) {
  final rand = Random.secure();
  return List.generate(length, (_) => _shortIdAlphabet[rand.nextInt(_shortIdAlphabet.length)]).join();
}

/// [DeploymentRepository] backed by the `deployments` table. RLS
/// (`deployments_owner_rw`) enforces that only the form's owner can publish.
class SupabaseDeploymentRepository implements DeploymentRepository {
  SupabaseDeploymentRepository(this._client);

  final SupabaseClient _client;

  @override
  Future<Result<DeploymentStatus>> publish(String formId) async {
    try {
      final existing = await _client
          .from('deployments')
          .select('short_id')
          .eq('form_id', formId)
          .maybeSingle();
      // Re-publishing reuses the existing short_id so previously-shared URLs
      // stay valid — only a brand-new deployment gets a fresh one.
      final shortId = existing?['short_id'] as String? ?? _generateShortId();

      final row = await _client
          .from('deployments')
          .upsert(
            {
              'form_id': formId,
              'status': 'published',
              'short_id': shortId,
              'published_at': DateTime.now().toIso8601String(),
            },
            onConflict: 'form_id',
          )
          .select('status, short_id, published_at')
          .single();

      return Result.ok(DeploymentStatus(
        status: row['status'] as String,
        shortId: row['short_id'] as String?,
        publishedAt: row['published_at'] == null ? null : DateTime.parse(row['published_at'] as String),
      ));
    } on Object catch (e) {
      return Result.error(DataException('publish_failed', cause: e));
    }
  }

  @override
  Future<Result<void>> unpublish(String formId) async {
    try {
      await _client.from('deployments').update({'status': 'archived'}).eq('form_id', formId);
      return const Result.ok(null);
    } on Object catch (e) {
      return Result.error(DataException('unpublish_failed', cause: e));
    }
  }
}
