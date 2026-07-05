import 'package:form_factor/form_factor.dart';
import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

/// Renders a [FormFactor] as semantic, accessible HTML (server-side).
///
/// This is the Jaspr counterpart of the Flutter editor's block renderer: both
/// switch over the SHARED sealed [BlockContent], so a form authored in the
/// editor renders identically in the public form (ADR-1, 04-public-renderer).
class FormRenderer extends StatelessComponent {
  const FormRenderer(this.factor, {super.key});

  final FormFactor factor;

  @override
  Component build(BuildContext context) {
    // Render start + question pages (endings shown after submit at runtime).
    final pages = factor.pages
        .where((page) => page.role != PageRole.ending)
        .toList(growable: false);

    final desc = factor.metadata.description;
    return form(
      id: 'formia-form',
      attributes: {'method': 'post', 'action': '/submit'},
      [
        h1([Component.text(factor.metadata.title)]),
        ?(desc == null ? null : p([Component.text(desc)])),
        for (final page in pages) ...[
          for (final block in page.blocks) _block(block),
        ],
        button(
          type: ButtonType.submit,
          [Component.text(factor.settings.submitButtonLabel)],
        ),
      ],
    );
  }

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
          input(
            id: b.id,
            name: b.id,
            type: InputType.text,
            attributes: {
              'autocomplete': 'on',
              'placeholder': ?placeholder,
              if (b.validation.required) 'required': 'true',
            },
          ),
        ),
      TextAreaContent(:final label, :final placeholder) => _field(
          b.id,
          label,
          textarea(
            id: b.id,
            name: b.id,
            attributes: {'placeholder': ?placeholder},
            [],
          ),
        ),
      DateContent(:final label) => _field(
          b.id,
          label,
          input(id: b.id, name: b.id, type: InputType.date),
        ),
      FileContent(:final label) => _field(
          b.id,
          label,
          input(id: b.id, name: b.id, type: InputType.file),
        ),
      ChoiceContent(:final label, :final options) => fieldset([
          legend([Component.text(label)]),
          for (final opt in options)
            label_(
              [
                input(
                  name: b.id,
                  value: opt.id,
                  type: InputType.radio,
                ),
                Component.text(' ${opt.label}'),
              ],
            ),
        ]),
      RatingContent(:final label, :final maxRating) => fieldset([
          legend([Component.text(label)]),
          for (var i = 1; i <= maxRating; i++)
            label_([
              input(name: b.id, value: '$i', type: InputType.radio),
              Component.text(' $i'),
            ]),
        ]),
    };
  }

  Component _field(String id, String labelText, Component control) => div([
        label([Component.text(labelText)], htmlFor: id),
        control,
      ]);

  // A <label> wrapping its control (no `for`) — used for radio options.
  Component label_(List<Component> children) => label(children);
}
