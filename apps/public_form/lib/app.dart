import 'package:jaspr/jaspr.dart';
import 'package:jaspr_router/jaspr_router.dart';

import 'pages/home.dart';
import 'pages/public_form_page.dart';

/// Root routing (04 doc): `/p/:shortId` is the only real public route.
/// `@client` so the interactive form (submit button, input handlers) hydrates
/// on the client after the server-rendered HTML paints (SEO/perf, ADR-1).
@client
class App extends StatelessComponent {
  const App({super.key});

  @override
  Component build(BuildContext context) {
    return Router(
      routes: [
        Route(path: '/', builder: (context, state) => const Home()),
        Route(
          path: '/p/:shortId',
          builder: (context, state) => PublicFormPage(shortId: state.params['shortId']!),
        ),
      ],
    );
  }
}
