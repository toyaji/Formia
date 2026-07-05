import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'providers/auth_controller.dart';
import 'ui/auth/login_page.dart';
import 'ui/builder/builder_page.dart';
import 'ui/dashboard/dashboard_page.dart';

/// Formia is guest-first (02 §5) — there is no forced login gate. `/login` is
/// reachable from the dashboard to upgrade a guest session; everything else
/// works without a Supabase session.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(Ref ref) {
    ref.listen(authControllerProvider, (previous, next) {
      if (previous?.isLoggedIn != next.isLoggedIn) notifyListeners();
    });
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRefresh(ref);
  return GoRouter(
    initialLocation: '/dashboard',
    refreshListenable: refresh,
    redirect: (context, state) {
      final isLoggedIn = ref.read(authControllerProvider).isLoggedIn;
      if (state.matchedLocation == '/login' && isLoggedIn) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/', redirect: (_, _) => '/dashboard'),
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/dashboard',
        name: 'dashboard',
        builder: (context, state) => const DashboardPage(),
      ),
      GoRoute(
        path: '/editor/:formId',
        name: 'editor',
        builder: (context, state) =>
            BuilderPage(formId: state.pathParameters['formId']!),
      ),
    ],
  );
});
