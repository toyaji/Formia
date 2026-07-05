import 'package:form_factor/form_factor.dart';
import 'package:formia_data/formia_data.dart';
import 'package:test/test.dart';

const _ts = '2026-07-05T00:00:00.000Z';

FormFactor baseFactor() => FormFactor(
      metadata: const FormMetadata(title: 't', createdAt: _ts, updatedAt: _ts),
      pages: const [
        FormPage(id: 's', role: PageRole.start, title: '시작', locked: true),
        FormPage(id: 'q1', role: PageRole.question, title: '1'),
        FormPage(id: 'e', role: PageRole.ending, title: '종료', locked: true),
      ],
    );

void main() {
  group('buildCommandFromTool', () {
    test('add_block builds AddBlockCommand with parsed content', () {
      final cmd = buildCommandFromTool(
        'add_block',
        {
          'pageId': 'q1',
          'type': 'text',
          'content': {'label': '이름이 뭐예요?'},
        },
        timestamp: _ts,
      );
      final doc = cmd.apply(baseFactor());
      final added = doc.pages.firstWhere((p) => p.id == 'q1').blocks.single;
      expect(added.content, isA<TextContent>());
      expect((added.content as TextContent).label, '이름이 뭐예요?');
      expect(cmd.meta.author, CommandAuthor.ai);
    });

    test('add_page builds AddPageCommand inserted before the ending', () {
      final cmd = buildCommandFromTool('add_page', {'title': '새 페이지'}, timestamp: _ts);
      final doc = cmd.apply(baseFactor());
      expect(doc.pages[doc.pages.length - 2].title, '새 페이지');
    });

    test('update_block requires content.type', () {
      expect(
        () => buildCommandFromTool(
          'update_block',
          {'blockId': 'x', 'content': {'label': 'no type'}},
          timestamp: _ts,
        ),
        throwsA(isA<ToolArgumentException>()),
      );
    });

    test('unknown tool throws ToolArgumentException', () {
      expect(
        () => buildCommandFromTool('not_a_tool', {}, timestamp: _ts),
        throwsA(isA<ToolArgumentException>()),
      );
    });

    test('get_form_summary is read-only (not a command)', () {
      expect(
        () => buildCommandFromTool('get_form_summary', {}, timestamp: _ts),
        throwsA(isA<UnsupportedError>()),
      );
    });

    test('missing required arg throws ToolArgumentException', () {
      expect(
        () => buildCommandFromTool('remove_block', {}, timestamp: _ts),
        throwsA(isA<ToolArgumentException>()),
      );
    });

    test('a full multi-tool turn collapses into one AiTurnCommand undo', () {
      var h = DocHistory(doc: baseFactor());
      final steps = [
        buildCommandFromTool(
          'add_page',
          {'title': '피드백'},
          timestamp: _ts,
        ),
        buildCommandFromTool(
          'add_block',
          {
            'pageId': 'q1',
            'type': 'rating',
            'content': {'label': '만족도'},
          },
          timestamp: _ts,
        ),
      ];
      final turnMeta = CommandMeta(author: CommandAuthor.ai, timestamp: _ts, code: 'ai.turn');
      h = h.execute(AiTurnCommand(steps: steps, meta: turnMeta));

      expect(h.doc.pages.length, 4);
      expect(h.doc.pages.firstWhere((p) => p.id == 'q1').blocks, hasLength(1));

      h = h.undo();
      expect(h.doc.pages.length, 3);
      expect(h.doc.pages.firstWhere((p) => p.id == 'q1').blocks, isEmpty);
    });
  });

  group('summarizeForm', () {
    test('reflects pages/blocks/roles', () {
      final summary = summarizeForm(baseFactor());
      expect(summary['title'], 't');
      final pages = summary['pages'] as List;
      expect(pages, hasLength(3));
      expect(pages[1], containsPair('id', 'q1'));
    });
  });
}
