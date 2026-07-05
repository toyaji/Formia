import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// `authControllerProvider`'s state (02 §2): the current Supabase session, or
/// `null` for a guest. UI/other providers watch this — nobody calls the
/// Supabase SDK directly outside this file (except `formia_data`'s Ports).
class AuthState {
  const AuthState({this.session});

  final Session? session;

  bool get isLoggedIn => session != null;
  String? get userId => session?.user.id;
}

final supabaseClientProvider = Provider<SupabaseClient>((ref) {
  return Supabase.instance.client;
});

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    final client = ref.watch(supabaseClientProvider);
    final sub = client.auth.onAuthStateChange.listen((data) {
      state = AuthState(session: data.session);
    });
    ref.onDispose(sub.cancel);
    return AuthState(session: client.auth.currentSession);
  }

  Future<void> signInWithGoogle() async {
    final client = ref.read(supabaseClientProvider);
    await client.auth.signInWithOAuth(OAuthProvider.google);
  }

  Future<void> signOut() async {
    final client = ref.read(supabaseClientProvider);
    await client.auth.signOut();
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
