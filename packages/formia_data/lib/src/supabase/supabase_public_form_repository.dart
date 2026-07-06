import 'package:form_factor/form_factor.dart';
import 'package:formia_core/formia_core.dart';
import 'package:supabase/supabase.dart';

import '../exceptions.dart';
import '../ports/public_form_repository.dart';

/// [PublicFormRepository] via the `get_public_form` security-definer RPC
/// (03 §1) — anon-key only, never exposes owner info or unpublished forms.
class SupabasePublicFormRepository implements PublicFormRepository {
  SupabasePublicFormRepository(this._client);

  final SupabaseClient _client;

  @override
  Future<Result<FormFactor>> getPublicForm(String shortId) async {
    try {
      final data = await _client.rpc('get_public_form', params: {'p_short_id': shortId});
      if (data == null) {
        return const Result.error(DataException('form_not_found_or_unpublished'));
      }
      return Result.ok(FormFactor.fromJson(data as Map));
    } on Object catch (e) {
      return Result.error(DataException('get_public_form_failed', cause: e));
    }
  }
}
