import 'package:form_factor/form_factor.dart';
import 'package:test/test.dart';

const _meta = FormMetadata(
  title: 't',
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z',
);

FormFactor factorWith(FormLogic logic) => FormFactor(
      metadata: _meta,
      logic: logic,
      pages: const [
        FormPage(id: 's', role: PageRole.start, title: '시작', blocks: [
          FormBlock(id: 'rating', content: RatingContent(label: 'r')),
          FormBlock(id: 'choice', content: ChoiceContent(label: 'c', options: [
            ChoiceOption(id: 'o1', label: 'A'),
          ])),
          FormBlock(id: 'name', content: TextContent(label: 'n')),
        ]),
        FormPage(id: 'e2', role: PageRole.ending, title: '2 종료'),
        FormPage(id: 'e', role: PageRole.ending, title: '종료'),
      ],
    );

void main() {
  const evaluator = LogicEvaluator();

  test('lt operator fires jump', () {
    final f = factorWith(const FormLogic(rules: [
      LogicRule(
        id: 'r',
        when: BlockAnswerCondition(
            blockId: 'rating', op: ConditionOperator.lt, value: 5),
        then: [JumpToPageAction(pageId: 'e2')],
      ),
    ]));
    expect(evaluator.evaluate(f, {'rating': 3}).jumpToPageId, 'e2');
    expect(evaluator.evaluate(f, {'rating': 8}).jumpToPageId, isNull);
  });

  test('and/or composition', () {
    final f = factorWith(const FormLogic(rules: [
      LogicRule(
        id: 'r',
        when: AndCondition(all: [
          BlockAnswerCondition(
              blockId: 'rating', op: ConditionOperator.gt, value: 3),
          OrCondition(any: [
            BlockAnswerCondition(
                blockId: 'choice', op: ConditionOperator.contains, value: 'o1'),
            BlockAnswerCondition(
                blockId: 'name', op: ConditionOperator.isNotEmpty),
          ]),
        ]),
        then: [HideBlockAction(blockId: 'name')],
      ),
    ]));
    // rating>3 AND (choice contains o1 OR name not empty)
    final hit = evaluator.evaluate(f, {
      'rating': 5,
      'choice': ['o1'],
    });
    expect(hit.isBlockVisible('name'), isFalse);

    final miss = evaluator.evaluate(f, {'rating': 2});
    expect(miss.isBlockVisible('name'), isTrue);
  });

  test('show overrides an earlier hide (last action wins per block)', () {
    final f = factorWith(const FormLogic(rules: [
      LogicRule(
        id: 'hide',
        when: BlockAnswerCondition(
            blockId: 'name', op: ConditionOperator.isEmpty),
        then: [HideBlockAction(blockId: 'choice')],
      ),
      LogicRule(
        id: 'show',
        when: BlockAnswerCondition(
            blockId: 'name', op: ConditionOperator.isEmpty),
        then: [ShowBlockAction(blockId: 'choice')],
      ),
    ]));
    expect(evaluator.evaluate(f, {'name': ''}).isBlockVisible('choice'), isTrue);
  });

  test('first firing jump wins', () {
    final f = factorWith(const FormLogic(rules: [
      LogicRule(
        id: 'a',
        when: BlockAnswerCondition(
            blockId: 'rating', op: ConditionOperator.equals, value: 1),
        then: [JumpToPageAction(pageId: 'e2')],
      ),
      LogicRule(
        id: 'b',
        when: BlockAnswerCondition(
            blockId: 'rating', op: ConditionOperator.equals, value: 1),
        then: [JumpToPageAction(pageId: 'e')],
      ),
    ]));
    expect(evaluator.evaluate(f, {'rating': 1}).jumpToPageId, 'e2');
  });
}
