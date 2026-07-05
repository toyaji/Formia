import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../providers/auth_controller.dart';
import '../../theme.dart';

class LoginPage extends ConsumerWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    ref.listen(authControllerProvider, (previous, next) {
      if (next.isLoggedIn) context.go('/dashboard');
    });
    return Scaffold(
      backgroundColor: FormiaColors.surface,
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const FormiaWordmark(fontSize: 32),
              const SizedBox(height: 32),
              Text(
                t.loginTitle,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => ref.read(authControllerProvider.notifier).signInWithGoogle(),
                  icon: const Icon(Icons.g_mobiledata, size: 22),
                  label: Text(t.loginWithGoogle),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => context.go('/dashboard'),
                child: Text(t.continueAsGuest),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
