import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

/// Minimal landing page — this app's real content lives at `/p/:shortId`
/// (see `pages/public_form_page.dart`).
class Home extends StatelessComponent {
  const Home({super.key});

  @override
  Component build(BuildContext context) {
    return main_([
      h1([Component.text('Formia')]),
      p([Component.text('공개 폼 링크를 통해 접속해 주세요.')]),
    ]);
  }
}
