/// Maps domain i18n keys (`FormFactorViolation.code` / `ValidationError.code`,
/// see `docs/flutter_migration/01-form-factor-v3.md#7`) to Korean copy. The
/// domain never owns UI text — only stable codes + params.
String domainMessageKo(String code, [Map<String, Object?> params = const {}]) {
  switch (code) {
    case 'pages.empty':
      return '폼에는 최소 한 페이지가 필요합니다.';
    case 'pages.firstMustBeStart':
    case 'pages.exactlyOneStart':
    case 'pages.startMustBeFirst':
      return '시작 페이지는 하나만, 맨 앞에 있어야 합니다.';
    case 'pages.lastMustBeEnding':
    case 'pages.atLeastOneEnding':
      return '마지막 페이지는 종료 페이지여야 합니다.';
    case 'pages.duplicateId':
      return '중복된 페이지 id입니다: ${params['id']}';
    case 'pages.notFound':
    case 'page.notFound':
      return '페이지를 찾을 수 없습니다.';
    case 'page.locked':
      return '이 페이지는 이동/삭제할 수 없습니다.';
    case 'blocks.duplicateId':
      return '중복된 블록 id입니다: ${params['id']}';
    case 'block.notFound':
      return '블록을 찾을 수 없습니다.';
    case 'block.notRemovable':
      return '이 블록은 삭제할 수 없습니다.';
    case 'block.content.unknownType':
      return '알 수 없는 블록 타입입니다: ${params['type']}';
    default:
      return '문제가 발생했습니다 ($code)';
  }
}
