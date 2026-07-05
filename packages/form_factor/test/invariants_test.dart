import 'package:form_factor/form_factor.dart';
import 'package:test/test.dart';

const _meta = FormMetadata(
  title: 't',
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z',
);

FormFactor build(List<FormPage> pages) =>
    FormFactor(metadata: _meta, pages: pages);

void main() {
  group('Page invariants', () {
    test('valid minimal factor (start + ending) constructs', () {
      expect(
        () => build(const [
          FormPage(id: 's', role: PageRole.start, title: '시작', locked: true),
          FormPage(id: 'e', role: PageRole.ending, title: '종료', locked: true),
        ]),
        returnsNormally,
      );
    });

    test('empty pages throws', () {
      expect(() => build(const []), throwsA(isA<FormFactorViolation>()));
    });

    test('missing start (first not start) throws', () {
      expect(
        () => build(const [
          FormPage(id: 'e', role: PageRole.ending, title: '종료'),
        ]),
        throwsA(isA<FormFactorViolation>()),
      );
    });

    test('missing ending (last not ending) throws', () {
      expect(
        () => build(const [
          FormPage(id: 's', role: PageRole.start, title: '시작'),
          FormPage(id: 'q', role: PageRole.question, title: '1'),
        ]),
        throwsA(isA<FormFactorViolation>()),
      );
    });

    test('two start pages throws', () {
      expect(
        () => build(const [
          FormPage(id: 's', role: PageRole.start, title: '시작'),
          FormPage(id: 's2', role: PageRole.start, title: '시작2'),
          FormPage(id: 'e', role: PageRole.ending, title: '종료'),
        ]),
        throwsA(isA<FormFactorViolation>()),
      );
    });

    test('duplicate page id throws', () {
      expect(
        () => build(const [
          FormPage(id: 'dup', role: PageRole.start, title: '시작'),
          FormPage(id: 'dup', role: PageRole.ending, title: '종료'),
        ]),
        throwsA(isA<FormFactorViolation>()),
      );
    });

    test('duplicate block id (across pages) throws', () {
      expect(
        () => build(const [
          FormPage(id: 's', role: PageRole.start, title: '시작', blocks: [
            FormBlock(id: 'b', content: InfoContent(body: 'x')),
          ]),
          FormPage(id: 'e', role: PageRole.ending, title: '종료', blocks: [
            FormBlock(id: 'b', content: InfoContent(body: 'y')),
          ]),
        ]),
        throwsA(isA<FormFactorViolation>()),
      );
    });

    test('early-exit ending in the middle is allowed', () {
      expect(
        () => build(const [
          FormPage(id: 's', role: PageRole.start, title: '시작'),
          FormPage(id: 'q', role: PageRole.question, title: '1'),
          FormPage(id: 'e2', role: PageRole.ending, title: '2 종료'),
          FormPage(id: 'e', role: PageRole.ending, title: '종료'),
        ]),
        returnsNormally,
      );
    });
  });
}
