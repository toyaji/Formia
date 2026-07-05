import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:formia_data/formia_data.dart';

import '../repository/local_draft_repository.dart';
import 'auth_controller.dart';

/// Injects the [FormRepository] implementation matching the current auth
/// state (02 §4): logged-in → Supabase, guest → local draft (Hive/IndexedDB).
/// Desktop file/hybrid repositories are a later addition — not required for
/// the web login/guest golden path in this phase.
final formRepositoryProvider = Provider<FormRepository>((ref) {
  final auth = ref.watch(authControllerProvider);
  if (auth.isLoggedIn) {
    final client = ref.watch(supabaseClientProvider);
    return SupabaseFormRepository(client);
  }
  return LocalDraftRepository();
});
