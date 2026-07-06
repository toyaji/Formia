import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:formia_data/formia_data.dart';

import 'auth_controller.dart';

/// Owner-side response reads (03 §6). Guests never have published forms, so
/// this is only meaningful when logged in — RLS denies anon reads regardless.
final responseRepositoryProvider = Provider<ResponseRepository>((ref) {
  final client = ref.watch(supabaseClientProvider);
  return SupabaseResponseRepository(client);
});
