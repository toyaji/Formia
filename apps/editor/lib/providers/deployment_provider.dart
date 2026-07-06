import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:formia_data/formia_data.dart';

import 'auth_controller.dart';

/// `null` for guests — guest forms are never public, so there is nothing to
/// publish (04 doc). Logged-in users get a real [DeploymentRepository].
final deploymentRepositoryProvider = Provider<DeploymentRepository?>((ref) {
  final auth = ref.watch(authControllerProvider);
  if (!auth.isLoggedIn) return null;
  final client = ref.watch(supabaseClientProvider);
  return SupabaseDeploymentRepository(client);
});

/// Base URL of the deployed `apps/public_form` app. Override with
/// `--dart-define=PUBLIC_FORM_BASE_URL=https://forms.example.com` for
/// staging/prod; defaults to the local `jaspr serve` port.
const publicFormBaseUrl = String.fromEnvironment(
  'PUBLIC_FORM_BASE_URL',
  defaultValue: 'http://localhost:8080',
);

String publicFormUrl(String shortId) => '$publicFormBaseUrl/p/$shortId';
