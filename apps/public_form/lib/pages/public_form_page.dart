import 'package:form_factor/form_factor.dart';
import 'package:formia_core/formia_core.dart';
import 'package:formia_data/formia_data.dart';
import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../service/supabase_client.dart';

/// Renders a published form at `/p/:shortId` (04 doc): fetches the factor via
/// the anon `get_public_form` RPC, renders it as an interactive HTML form,
/// and submits answers through `submit-response` (never a direct insert).
///
/// Scope note: this renders all question blocks on one page — multi-page
/// navigation + branching (`LogicEvaluator`) is deferred; see
/// `docs/flutter_migration/08-task-briefs.md` Phase 6 log.
class PublicFormPage extends StatefulComponent {
  const PublicFormPage({required this.shortId, super.key});

  final String shortId;

  @override
  State<PublicFormPage> createState() => _PublicFormPageState();
}

class _PublicFormPageState extends State<PublicFormPage> with PreloadStateMixin {
  final _repo = SupabasePublicFormRepository(publicSupabaseClient);
  final _responseRepo = SupabaseResponseRepository(publicSupabaseClient);

  FormFactor? _factor;
  String? _loadError;
  bool _submitted = false;
  bool _submitting = false;
  String? _submitError;
  final Map<String, Object?> _answers = {};

  @override
  Future<void> preloadState() => _load();

  @override
  void initState() {
    super.initState();
    if (_factor == null && _loadError == null) {
      // preloadState only runs server-side (avoids unallowed rebuilds there);
      // the client re-fetches on hydration.
      _load().then((_) {
        if (mounted) setState(() {});
      });
    }
  }

  Future<void> _load() async {
    final result = await _repo.getPublicForm(component.shortId);
    switch (result) {
      case Ok(:final value):
        _factor = value;
      case Error(:final error):
        _loadError = error.toString();
    }
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    final result = await _responseRepo.submit(component.shortId, _answers, const ResponseMeta());
    setState(() {
      _submitting = false;
      switch (result) {
        case Ok():
          _submitted = true;
        case Error(:final error):
          _submitError = error.toString();
      }
    });
  }

  @override
  Component build(BuildContext context) {
    if (_loadError != null) {
      return main_([
        h1([Component.text('폼을 찾을 수 없습니다')]),
        p([Component.text('게시되지 않았거나 존재하지 않는 폼입니다.')]),
      ]);
    }
    final factor = _factor;
    if (factor == null) {
      return main_([p([Component.text('불러오는 중…')])]);
    }
    if (_submitted) {
      final ending = factor.pages.lastWhere(
        (page) => page.role == PageRole.ending,
        orElse: () => factor.pages.last,
      );
      return main_([
        h1([Component.text(ending.title)]),
        ?_paragraph(ending.description),
      ]);
    }

    final questionPages = factor.pages.where((page) => page.role == PageRole.question);

    return main_([
      h1([Component.text(factor.metadata.title)]),
      ?_paragraph(factor.metadata.description),
      div(id: 'formia-form', [
        for (final page in questionPages) for (final block in page.blocks) _block(block),
        ?_paragraph(_submitError, classes: 'formia-error'),
        button(
          [Component.text(_submitting ? '제출 중…' : factor.settings.submitButtonLabel)],
          type: ButtonType.button,
          disabled: _submitting,
          onClick: _submit,
        ),
      ]),
    ]);
  }

  Component? _paragraph(String? text, {String? classes}) =>
      text == null ? null : p(classes: classes, [Component.text(text)]);

  Component _block(FormBlock b) {
    final content = b.content;
    return switch (content) {
      StatementContent(:final label, :final body) => div([
          ?(label == null ? null : h2([Component.text(label)])),
          ?(body == null ? null : p([Component.text(body)])),
        ]),
      InfoContent(:final body) => p([Component.text(body)]),
      TextContent(:final label, :final placeholder) => _field(
          b.id,
          label,
          input<String>(
            id: b.id,
            name: b.id,
            type: InputType.text,
            attributes: {'autocomplete': 'on', 'placeholder': ?placeholder},
            onInput: (v) => _answers[b.id] = v,
          ),
        ),
      TextAreaContent(:final label, :final placeholder) => _field(
          b.id,
          label,
          textarea(
            [],
            id: b.id,
            name: b.id,
            placeholder: placeholder,
            onInput: (v) => _answers[b.id] = v,
          ),
        ),
      DateContent(:final label) => _field(
          b.id,
          label,
          input<DateTime>(id: b.id, name: b.id, type: InputType.date, onInput: (v) => _answers[b.id] = v.toIso8601String()),
        ),
      // File upload (Storage signed-upload wiring is a later addition, 04 §3
      // — the control renders but its value is intentionally not captured).
      FileContent(:final label) => _field(
          b.id,
          label,
          input(id: b.id, name: b.id, type: InputType.file),
        ),
      ChoiceContent(:final label, :final options) => fieldset([
          legend([Component.text(label)]),
          for (final opt in options)
            label_([
              input<bool>(
                name: b.id,
                value: opt.id,
                type: InputType.radio,
                onChange: (checked) {
                  if (checked) _answers[b.id] = opt.id;
                },
              ),
              Component.text(' ${opt.label}'),
            ]),
        ]),
      RatingContent(:final label, :final maxRating) => fieldset([
          legend([Component.text(label)]),
          for (var i = 1; i <= maxRating; i++)
            label_([
              input<bool>(
                name: b.id,
                value: '$i',
                type: InputType.radio,
                onChange: (checked) {
                  if (checked) _answers[b.id] = i;
                },
              ),
              Component.text(' $i'),
            ]),
        ]),
    };
  }

  Component _field(String id, String labelText, Component control) => div([
        label([Component.text(labelText)], htmlFor: id),
        control,
      ]);

  Component label_(List<Component> children) => label(children);
}
