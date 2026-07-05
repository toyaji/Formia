import 'package:form_factor/form_factor.dart';
import 'package:test/test.dart';

const _meta = CommandMeta(
  author: CommandAuthor.human,
  timestamp: '2026-07-05T00:00:00.000Z',
  code: 'test',
);

FormFactor baseFactor() => FormFactor(
      metadata: const FormMetadata(
        title: 't',
        createdAt: '2026-07-05T00:00:00.000Z',
        updatedAt: '2026-07-05T00:00:00.000Z',
      ),
      pages: const [
        FormPage(id: 's', role: PageRole.start, title: '시작', locked: true, blocks: [
          FormBlock(
            id: 'header',
            content: StatementContent(label: '환영'),
            removable: false,
          ),
        ]),
        FormPage(id: 'q1', role: PageRole.question, title: '1'),
        FormPage(id: 'e', role: PageRole.ending, title: '종료', locked: true),
      ],
    );

int blockCount(FormFactor f) =>
    f.pages.fold(0, (sum, p) => sum + p.blocks.length);

void main() {
  test('AddBlockCommand adds; undo reverts; redo reapplies', () {
    var h = DocHistory(doc: baseFactor());
    final before = blockCount(h.doc);

    h = h.execute(AddBlockCommand(
      pageId: 'q1',
      block: const FormBlock(id: 'nb', content: TextContent(label: '이름')),
      meta: _meta,
    ));
    expect(blockCount(h.doc), before + 1);
    expect(h.canUndo, isTrue);

    h = h.undo();
    expect(blockCount(h.doc), before);
    expect(h.canRedo, isTrue);

    h = h.redo();
    expect(blockCount(h.doc), before + 1);
  });

  test('RemoveBlockCommand refuses a non-removable block', () {
    final h = DocHistory(doc: baseFactor());
    expect(
      () => h.execute(RemoveBlockCommand(blockId: 'header', meta: _meta)),
      throwsA(isA<FormFactorViolation>()),
    );
  });

  test('ReorderPageCommand refuses moving a locked page', () {
    final h = DocHistory(doc: baseFactor());
    expect(
      () => h.execute(ReorderPageCommand(pageId: 's', toIndex: 1, meta: _meta)),
      throwsA(isA<FormFactorViolation>()),
    );
  });

  test('AiTurnCommand = one atomic undo unit', () {
    var h = DocHistory(doc: baseFactor());
    final before = blockCount(h.doc);

    h = h.execute(AiTurnCommand(
      meta: const CommandMeta(
        author: CommandAuthor.ai,
        timestamp: '2026-07-05T00:00:00.000Z',
        code: 'ai.turn',
      ),
      steps: [
        AddBlockCommand(
          pageId: 'q1',
          block: const FormBlock(id: 'a', content: TextContent(label: 'A')),
          meta: _meta,
        ),
        AddBlockCommand(
          pageId: 'q1',
          block: const FormBlock(id: 'b', content: TextContent(label: 'B')),
          meta: _meta,
        ),
        AddBlockCommand(
          pageId: 'q1',
          block: const FormBlock(id: 'c', content: TextContent(label: 'C')),
          meta: _meta,
        ),
      ],
    ));
    expect(blockCount(h.doc), before + 3);
    expect(h.undoStack.length, 1); // three steps, ONE history entry

    h = h.undo(); // single undo reverts the whole turn
    expect(blockCount(h.doc), before);
  });

  test('AiTurnCommand rolls back entirely if a step fails mid-chain', () {
    final h = DocHistory(doc: baseFactor());
    final original = h.doc.toJson();

    // Second step is invalid (duplicate id 'a') → whole turn must fail atomically.
    expect(
      () => h.execute(AiTurnCommand(
        meta: _meta,
        steps: [
          AddBlockCommand(
            pageId: 'q1',
            block: const FormBlock(id: 'a', content: TextContent(label: 'A')),
            meta: _meta,
          ),
          AddBlockCommand(
            pageId: 'q1',
            block: const FormBlock(id: 'a', content: TextContent(label: 'dup')),
            meta: _meta,
          ),
        ],
      )),
      throwsA(isA<FormFactorViolation>()),
    );
    // History unchanged, document untouched.
    expect(h.canUndo, isFalse);
    expect(h.doc.toJson(), original);
  });

  test('AddPageCommand inserts before the trailing ending; undo reverts', () {
    var h = DocHistory(doc: baseFactor());
    final before = h.doc.pages.length;

    h = h.execute(AddPageCommand(
      page: const FormPage(id: 'q2', role: PageRole.question, title: '2'),
      meta: _meta,
    ));
    expect(h.doc.pages.length, before + 1);
    expect(h.doc.pages[h.doc.pages.length - 2].id, 'q2');
    expect(h.doc.pages.last.role, PageRole.ending); // invariant still holds

    h = h.undo();
    expect(h.doc.pages.length, before);
  });

  test('RemovePageCommand removes a question page; undo reverts', () {
    var h = DocHistory(doc: baseFactor());
    h = h.execute(RemovePageCommand(pageId: 'q1', meta: _meta));
    expect(h.doc.pages.any((p) => p.id == 'q1'), isFalse);

    h = h.undo();
    expect(h.doc.pages.any((p) => p.id == 'q1'), isTrue);
  });

  test('RemovePageCommand refuses a locked page', () {
    final h = DocHistory(doc: baseFactor());
    expect(
      () => h.execute(RemovePageCommand(pageId: 's', meta: _meta)),
      throwsA(isA<FormFactorViolation>()),
    );
  });

  test('RemovePageCommand refuses removing the only ending page', () {
    final onlyEnding = FormFactor(
      metadata: baseFactor().metadata,
      pages: const [
        FormPage(id: 's', role: PageRole.start, title: '시작', locked: true),
        FormPage(id: 'e', role: PageRole.ending, title: '종료', locked: false),
      ],
    );
    final h = DocHistory(doc: onlyEnding);
    expect(
      () => h.execute(RemovePageCommand(pageId: 'e', meta: _meta)),
      throwsA(isA<FormFactorViolation>()),
    );
  });
}
