import 'package:collection/collection.dart';
import 'package:form_factor/form_factor.dart';
import 'package:test/test.dart';

import 'fixtures.dart';

const _eq = DeepCollectionEquality();

void main() {
  group('FormFactor JSON round-trip', () {
    test('full factor with every block type & logic node survives round-trip',
        () {
      final original = sampleFactor().toJson();
      final back = FormFactor.fromJson(original).toJson();
      expect(_eq.equals(original, back), isTrue,
          reason: 'round-trip should be lossless');
    });
  });

  group('BlockContent subtypes round-trip', () {
    final contents = <BlockContent>[
      const TextContent(label: 'a', placeholder: 'p', helpText: 'h'),
      const TextAreaContent(label: 'a'),
      const ChoiceContent(
        label: 'a',
        options: [ChoiceOption(id: 'x', label: 'X')],
        multiSelect: true,
        allowOther: true,
      ),
      const RatingContent(label: 'a', maxRating: 7, style: RatingStyle.emoji),
      const DateContent(label: 'a', includeTime: true),
      const FileContent(label: 'a', acceptedTypes: ['pdf'], maxSizeMb: 3),
      const InfoContent(body: 'b'),
      const StatementContent(label: 'l', body: 'b'),
    ];

    for (final c in contents) {
      test('${c.type} round-trips', () {
        final json = c.toJson();
        final back = BlockContent.fromJson(json).toJson();
        expect(_eq.equals(json, back), isTrue);
        expect(back['type'], c.type);
      });
    }

    test('unknown block type throws', () {
      expect(
        () => BlockContent.fromJson({'type': 'nope'}),
        throwsA(isA<FormFactorViolation>()),
      );
    });
  });

  group('Logic condition/action round-trip', () {
    final conditions = <LogicCondition>[
      const BlockAnswerCondition(
          blockId: 'b', op: ConditionOperator.equals, value: 'v'),
      const AndCondition(all: [
        BlockAnswerCondition(blockId: 'b', op: ConditionOperator.gt, value: 1),
      ]),
      const OrCondition(any: [
        BlockAnswerCondition(blockId: 'b', op: ConditionOperator.isEmpty),
      ]),
    ];
    for (final c in conditions) {
      test('${c.type} condition round-trips', () {
        final json = c.toJson();
        final back = LogicCondition.fromJson(json).toJson();
        expect(_eq.equals(json, back), isTrue);
      });
    }

    final actions = <LogicAction>[
      const JumpToPageAction(pageId: 'p'),
      const ShowBlockAction(blockId: 'b'),
      const HideBlockAction(blockId: 'b'),
    ];
    for (final a in actions) {
      test('${a.type} action round-trips', () {
        final json = a.toJson();
        final back = LogicAction.fromJson(json).toJson();
        expect(_eq.equals(json, back), isTrue);
      });
    }
  });
}
