import 'package:formia_core/formia_core.dart';
import 'package:supabase/supabase.dart';

import '../exceptions.dart';
import '../ports/response_repository.dart';

/// [ResponseRepository] that submits through the `submit-response` edge
/// function (never a direct table insert), so rate limiting / size caps /
/// published checks apply (03 §2, §5). Uses an anon Supabase client.
class SupabaseResponseRepository implements ResponseRepository {
  SupabaseResponseRepository(this._client);

  final SupabaseClient _client;

  @override
  Future<Result<void>> submit(
    String shortId,
    Map<String, Object?> answers,
    ResponseMeta meta,
  ) async {
    try {
      final res = await _client.functions.invoke(
        'submit-response',
        body: {
          'shortId': shortId,
          'answers': answers,
          'metadata': meta.toJson(),
        },
      );
      if (res.status >= 200 && res.status < 300) {
        return const Result.ok(null);
      }
      final err = (res.data is Map) ? res.data['error'] : res.status;
      return Result.error(DataException('submit_failed: $err'));
    } on Object catch (e) {
      return Result.error(DataException('submit_failed', cause: e));
    }
  }
}
