import 'package:form_factor/form_factor.dart';
import 'package:test/test.dart';

/// The real legacy v2 default form (mirrors src/lib/constants/defaultForm.ts).
Map<String, dynamic> legacyDefaultForm() => {
      'version': '2.0.0',
      'metadata': {
        'title': 'Formia 설문지',
        'description': '앞으로 AI Agent가 당신의 설문을 만들어 드립니다.',
        'createdAt': '2026-07-05T00:00:00.000Z',
        'updatedAt': '2026-07-05T00:00:00.000Z',
      },
      'theme': {'mode': 'light', 'tokens': {}},
      'pages': {
        'start': {
          'id': 'start',
          'type': 'start',
          'title': '시작 페이지',
          'description': 'AI가 만들어 드립니다.',
          'blocks': [
            {
              'id': 'start-block-1',
              'type': 'statement',
              'content': {'label': 'Formia 설문지', 'body': '설명'},
              'removable': false,
            },
            {
              'id': 'q1',
              'type': 'text',
              'content': {'label': '이름', 'placeholder': '예: 홍길동'},
              'validation': {'required': true},
              'removable': true,
            },
            {
              'id': 'q2',
              'type': 'choice',
              'content': {
                'label': '경로',
                'options': ['지인 추천', 'SNS 광고', '검색', '기타'],
              },
              'removable': true,
            },
          ],
          'removable': false,
        },
        'questions': [],
        'endings': [
          {
            'id': 'end',
            'type': 'ending',
            'title': '완료 페이지',
            'blocks': [
              {
                'id': 'end-block-1',
                'type': 'statement',
                'content': {'label': '완료', 'body': '감사합니다'},
                'removable': true,
              },
            ],
            'removable': true,
          },
        ],
      },
    };

void main() {
  final migrator = FormFactorMigrator();

  test('real v2 default form migrates losslessly to a valid v3 factor', () {
    final result = migrator.migrate(legacyDefaultForm());

    expect(result.isLossless, isTrue,
        reason: 'no field should be dropped without a mapping: '
            '${result.warnings}');

    // Parses into a valid, invariant-satisfying v3 model.
    final factor = FormFactor.fromJson(result.json);
    expect(factor.schemaVersion, '3.0.0');
    expect(factor.pages.first.role, PageRole.start);
    expect(factor.pages.first.locked, isTrue);
    expect(factor.pages.last.role, PageRole.ending);
    expect(factor.pages.last.locked, isTrue);

    // choice options string[] -> ChoiceOption(id,label)
    final choice = factor.pages.first.blocks
        .map((b) => b.content)
        .whereType<ChoiceContent>()
        .single;
    expect(choice.options.length, 4);
    expect(choice.options.first.label, '지인 추천');
    expect(choice.options.every((o) => o.id.isNotEmpty), isTrue);
  });

  test('unmapped content field is quarantined as a warning, not dropped', () {
    final v2 = legacyDefaultForm();
    // Inject a field with no v3 home.
    (((v2['pages'] as Map)['start'] as Map)['blocks'] as List)[1]['content']
        ['legacyOnlyField'] = 'keepme';

    final result = migrator.migrate(v2);
    expect(result.isLossless, isFalse);
    final w = result.warnings.firstWhere((w) => w.value == 'keepme');
    expect(w.reason, 'unmappedField');
    expect(w.path, contains('legacyOnlyField'));
  });

  test('unknown block type is warned and preserved (not silently lost)', () {
    final v2 = legacyDefaultForm();
    (((v2['pages'] as Map)['start'] as Map)['blocks'] as List).add({
      'id': 'weird',
      'type': 'hologram',
      'content': {'label': '미래 블록'},
      'removable': true,
    });

    final result = migrator.migrate(v2);
    expect(result.warnings.any((w) => w.reason == 'block.unknownType'), isTrue);
    // still yields a valid factor
    expect(() => FormFactor.fromJson(result.json), returnsNormally);
  });

  test('already-v3 json passes through untouched with no warnings', () {
    final v3 = {
      'schemaVersion': '3.0.0',
      'metadata': {
        'title': 't',
        'createdAt': '2026-07-05T00:00:00.000Z',
        'updatedAt': '2026-07-05T00:00:00.000Z',
      },
      'theme': {'mode': 'light', 'tokens': {}},
      'pages': [
        {'id': 's', 'role': 'start', 'title': '시작', 'blocks': [], 'locked': true},
        {'id': 'e', 'role': 'ending', 'title': '종료', 'blocks': [], 'locked': true},
      ],
      'logic': {'rules': []},
    };
    final result = migrator.migrate(v3);
    expect(result.isLossless, isTrue);
    expect(() => FormFactor.fromJson(result.json), returnsNormally);
  });
}
