import 'package:form_factor/form_factor.dart';
import 'package:uuid/uuid.dart';

const _uuid = Uuid();

/// A new, empty (but structurally valid — §1.1) form: one start page, one
/// blank question page, one ending page.
FormFactor blankFormFactor({String title = '제목 없는 폼'}) {
  final now = DateTime.now().toIso8601String();
  return FormFactor(
    metadata: FormMetadata(title: title, createdAt: now, updatedAt: now),
    pages: [
      FormPage(id: _uuid.v4(), role: PageRole.start, title: title, locked: true),
      FormPage(
        id: _uuid.v4(),
        role: PageRole.question,
        title: '질문 1',
        blocks: [
          FormBlock(
            id: _uuid.v4(),
            content: const TextContent(label: '질문을 입력하세요'),
          ),
        ],
      ),
      FormPage(
        id: _uuid.v4(),
        role: PageRole.ending,
        title: '제출이 완료되었습니다',
        locked: true,
      ),
    ],
  );
}
