import 'package:form_factor/form_factor.dart';
import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../components/form_renderer.dart';

/// Spike (Task 0.2): render a shared-model [FormFactor] as server-side HTML.
class Home extends StatelessComponent {
  const Home({super.key});

  @override
  Component build(BuildContext context) {
    return section([
      FormRenderer(_sampleForm()),
    ]);
  }
}

FormFactor _sampleForm() => FormFactor(
      metadata: const FormMetadata(
        title: '고객 만족도 설문',
        description: '서비스 개선을 위해 잠시만 시간을 내주세요.',
        createdAt: '2026-07-05T00:00:00.000Z',
        updatedAt: '2026-07-05T00:00:00.000Z',
      ),
      pages: const [
        FormPage(
          id: 'start',
          role: PageRole.start,
          title: '시작 페이지',
          locked: true,
          blocks: [
            FormBlock(
              id: 'name',
              content: TextContent(label: '성함을 입력해 주세요', placeholder: '홍길동'),
              validation: BlockValidation(required: true),
            ),
            FormBlock(
              id: 'channel',
              content: ChoiceContent(
                label: '어떤 경로로 방문하셨나요?',
                options: [
                  ChoiceOption(id: 'search', label: '검색'),
                  ChoiceOption(id: 'sns', label: 'SNS'),
                  ChoiceOption(id: 'refer', label: '지인 추천'),
                ],
              ),
            ),
            FormBlock(
              id: 'score',
              content: RatingContent(label: '만족도를 평가해 주세요', maxRating: 5),
            ),
          ],
        ),
        FormPage(id: 'end', role: PageRole.ending, title: '종료 페이지', locked: true),
      ],
    );
