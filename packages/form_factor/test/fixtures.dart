import 'package:form_factor/form_factor.dart';

/// A valid Form Factor exercising every block type and logic node, used as a
/// round-trip fixture.
FormFactor sampleFactor() => FormFactor(
      metadata: const FormMetadata(
        title: '샘플 설문',
        description: '테스트용',
        createdAt: '2026-07-05T00:00:00.000Z',
        updatedAt: '2026-07-05T00:00:00.000Z',
      ),
      theme: const FormTheme(
        mode: ThemeMode.dark,
        tokens: {'primary': '#3B82F6', 'radius': '8px'},
      ),
      pages: [
        const FormPage(
          id: 'start',
          role: PageRole.start,
          title: '시작 페이지',
          locked: true,
          blocks: [
            FormBlock(
              id: 'b_statement',
              content: StatementContent(label: '환영합니다', body: '시작해봅시다'),
              removable: false,
            ),
          ],
        ),
        FormPage(
          id: 'p1',
          role: PageRole.question,
          title: '1페이지',
          description: '기본 정보',
          blocks: [
            const FormBlock(
              id: 'b_text',
              content: TextContent(
                label: '성함',
                placeholder: '홍길동',
                helpText: '실명을 입력',
              ),
              validation: BlockValidation(required: true, pattern: r'^\S+$'),
            ),
            const FormBlock(
              id: 'b_textarea',
              content: TextAreaContent(label: '자기소개', placeholder: '...'),
            ),
            const FormBlock(
              id: 'b_choice',
              content: ChoiceContent(
                label: '관심사',
                options: [
                  ChoiceOption(id: 'o1', label: '코딩'),
                  ChoiceOption(id: 'o2', label: '디자인'),
                ],
                multiSelect: true,
                allowOther: true,
                helpText: '복수 선택 가능',
              ),
            ),
            const FormBlock(
              id: 'b_rating',
              content: RatingContent(
                label: '만족도',
                maxRating: 10,
                style: RatingStyle.number,
              ),
            ),
            const FormBlock(
              id: 'b_date',
              content: DateContent(label: '생년월일', includeTime: false),
            ),
            const FormBlock(
              id: 'b_file',
              content: FileContent(
                label: '이력서',
                acceptedTypes: ['pdf', 'docx'],
                maxSizeMb: 20,
              ),
            ),
            const FormBlock(
              id: 'b_info',
              content: InfoContent(body: '**안내** 마크다운'),
              style: {'align': 'center'},
            ),
          ],
        ),
        const FormPage(
          id: 'end_early',
          role: PageRole.ending,
          title: '2 종료 페이지',
        ),
        const FormPage(
          id: 'end',
          role: PageRole.ending,
          title: '종료 페이지',
          locked: true,
        ),
      ],
      logic: const FormLogic(
        rules: [
          LogicRule(
            id: 'r1',
            when: AndCondition(
              all: [
                BlockAnswerCondition(
                  blockId: 'b_rating',
                  op: ConditionOperator.lt,
                  value: 5,
                ),
                OrCondition(
                  any: [
                    BlockAnswerCondition(
                      blockId: 'b_choice',
                      op: ConditionOperator.contains,
                      value: 'o1',
                    ),
                    BlockAnswerCondition(
                      blockId: 'b_text',
                      op: ConditionOperator.isNotEmpty,
                    ),
                  ],
                ),
              ],
            ),
            then: [
              JumpToPageAction(pageId: 'end_early'),
              HideBlockAction(blockId: 'b_textarea'),
              ShowBlockAction(blockId: 'b_info'),
            ],
          ),
        ],
      ),
    );
