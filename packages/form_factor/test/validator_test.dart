import 'package:form_factor/form_factor.dart';
import 'package:test/test.dart';

const _meta = FormMetadata(
  title: 't',
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z',
);

FormFactor factor(List<FormPage> pages, {FormLogic logic = const FormLogic()}) =>
    FormFactor(metadata: _meta, pages: pages, logic: logic);

bool hasCode(List<ValidationError> errs, String code) =>
    errs.any((e) => e.code == code);

void main() {
  const validator = FormFactorValidator();

  test('clean form has no errors', () {
    final errs = validator.validate(factor(const [
      FormPage(id: 's', role: PageRole.start, title: '시작'),
      FormPage(id: 'q', role: PageRole.question, title: '1', blocks: [
        FormBlock(id: 'b', content: TextContent(label: 'q')),
      ]),
      FormPage(id: 'e', role: PageRole.ending, title: '종료'),
    ]));
    expect(errs, isEmpty);
  });

  test('dangling block reference in condition is reported', () {
    final errs = validator.validate(factor(
      const [
        FormPage(id: 's', role: PageRole.start, title: '시작'),
        FormPage(id: 'e', role: PageRole.ending, title: '종료'),
      ],
      logic: const FormLogic(rules: [
        LogicRule(
          id: 'r',
          when: BlockAnswerCondition(
              blockId: 'ghost', op: ConditionOperator.equals, value: 1),
          then: [ShowBlockAction(blockId: 'ghost')],
        ),
      ]),
    ));
    expect(hasCode(errs, 'logic.danglingBlock'), isTrue);
  });

  test('dangling page reference in jump is reported', () {
    final errs = validator.validate(factor(
      const [
        FormPage(id: 's', role: PageRole.start, title: '시작', blocks: [
          FormBlock(id: 'b', content: TextContent(label: 'q')),
        ]),
        FormPage(id: 'e', role: PageRole.ending, title: '종료'),
      ],
      logic: const FormLogic(rules: [
        LogicRule(
          id: 'r',
          when: BlockAnswerCondition(
              blockId: 'b', op: ConditionOperator.isNotEmpty),
          then: [JumpToPageAction(pageId: 'nowhere')],
        ),
      ]),
    ));
    expect(hasCode(errs, 'logic.danglingPage'), isTrue);
  });

  test('page stranded behind an early-exit ending is unreachable', () {
    // start -> q1 -> end_early (terminates). q2 & end are unreachable
    // because no jump edge leads to them.
    final errs = validator.validate(factor(const [
      FormPage(id: 's', role: PageRole.start, title: '시작'),
      FormPage(id: 'q1', role: PageRole.question, title: '1'),
      FormPage(id: 'end_early', role: PageRole.ending, title: '2 종료'),
      FormPage(id: 'q2', role: PageRole.question, title: '2'),
      FormPage(id: 'end', role: PageRole.ending, title: '종료'),
    ]));
    expect(hasCode(errs, 'pages.unreachable'), isTrue);
  });

  test('a forward jump rescues an otherwise-stranded page', () {
    final errs = validator.validate(factor(
      const [
        FormPage(id: 's', role: PageRole.start, title: '시작', blocks: [
          FormBlock(id: 'b', content: TextContent(label: 'q')),
        ]),
        FormPage(id: 'q1', role: PageRole.question, title: '1'),
        FormPage(id: 'end_early', role: PageRole.ending, title: '2 종료'),
        FormPage(id: 'q2', role: PageRole.question, title: '2'),
        FormPage(id: 'end', role: PageRole.ending, title: '종료'),
      ],
      logic: const FormLogic(rules: [
        LogicRule(
          id: 'r',
          when: BlockAnswerCondition(
              blockId: 'b', op: ConditionOperator.isNotEmpty),
          then: [JumpToPageAction(pageId: 'q2')],
        ),
      ]),
    ));
    expect(hasCode(errs, 'pages.unreachable'), isFalse);
  });

  test('backward jump to a non-ending page is a warning', () {
    final errs = validator.validate(factor(
      const [
        FormPage(id: 's', role: PageRole.start, title: '시작'),
        FormPage(id: 'q1', role: PageRole.question, title: '1'),
        FormPage(id: 'q2', role: PageRole.question, title: '2', blocks: [
          FormBlock(id: 'b', content: TextContent(label: 'q')),
        ]),
        FormPage(id: 'e', role: PageRole.ending, title: '종료'),
      ],
      logic: const FormLogic(rules: [
        LogicRule(
          id: 'r',
          when: BlockAnswerCondition(
              blockId: 'b', op: ConditionOperator.isNotEmpty),
          then: [JumpToPageAction(pageId: 'q1')], // back from q2 to q1
        ),
      ]),
    ));
    final warn = errs.firstWhere((e) => e.code == 'logic.backwardJump',
        orElse: () => const ValidationError('none'));
    expect(warn.code, 'logic.backwardJump');
    expect(warn.severity, ValidationSeverity.warning);
  });
}
