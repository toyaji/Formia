// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Korean (`ko`).
class AppLocalizationsKo extends AppLocalizations {
  AppLocalizationsKo([String locale = 'ko']) : super(locale);

  @override
  String get appTitle => 'Formia';

  @override
  String get loginTitle => 'Formia에 오신 것을 환영합니다';

  @override
  String get loginWithGoogle => 'Google로 계속하기';

  @override
  String get continueAsGuest => '게스트로 계속하기';

  @override
  String get dashboardTitle => '내 폼';

  @override
  String get createForm => '새 폼 만들기';

  @override
  String get untitledForm => '제목 없는 폼';

  @override
  String get deleteForm => '삭제';

  @override
  String get deleteFormConfirm => '이 폼을 삭제할까요? 되돌릴 수 없습니다.';

  @override
  String get cancel => '취소';

  @override
  String get confirm => '확인';

  @override
  String get openForm => '열기';

  @override
  String get signOut => '로그아웃';

  @override
  String get emptyFormsList => '아직 만든 폼이 없습니다.';

  @override
  String get saveStatusIdle => '';

  @override
  String get saveStatusSaving => '저장 중…';

  @override
  String get saveStatusSaved => '저장됨';

  @override
  String get saveStatusError => '저장 실패';

  @override
  String get undo => '실행 취소';

  @override
  String get redo => '다시 실행';

  @override
  String get addBlock => '블록 추가';

  @override
  String get blockTypeText => '단답형';

  @override
  String get blockTypeTextarea => '장문형';

  @override
  String get blockTypeChoice => '객관식';

  @override
  String get blockTypeRating => '평점';

  @override
  String get blockTypeDate => '날짜';

  @override
  String get blockTypeFile => '파일 업로드';

  @override
  String get blockTypeInfo => '안내문';

  @override
  String get blockTypeStatement => '구분선/설명';

  @override
  String get deleteBlock => '블록 삭제';

  @override
  String get viewportDesktop => '데스크톱';

  @override
  String get viewportMobile => '모바일';

  @override
  String get previewToggle => '미리보기';

  @override
  String get editToggle => '편집';

  @override
  String get restoreDraftTitle => '임시 저장된 폼이 있습니다';

  @override
  String get restoreDraftBody => '이전에 게스트로 작업하던 폼을 이어서 편집할까요?';

  @override
  String get restoreDraftRestore => '이어서 편집';

  @override
  String get restoreDraftDiscard => '새로 시작';

  @override
  String get pageStart => '시작 페이지';

  @override
  String get pageQuestion => '질문 페이지';

  @override
  String get pageEnding => '종료 페이지';

  @override
  String get questionLabel => '질문';

  @override
  String get helpText => '도움말';

  @override
  String get placeholder => '안내 문구';

  @override
  String get choiceOptions => '선택지 (쉼표로 구분)';

  @override
  String get multiSelect => '복수 선택 허용';

  @override
  String get ratingMax => '최대 점수';

  @override
  String get includeTime => '시간 포함';

  @override
  String get acceptedTypes => '허용 파일 형식 (쉼표로 구분)';

  @override
  String get infoBody => '안내 내용';

  @override
  String get loadError => '폼을 불러오지 못했습니다';

  @override
  String get genericError => '오류가 발생했습니다';

  @override
  String get aiPanelTitle => 'AI 도우미';

  @override
  String get aiKeySettings => 'AI 키 설정';

  @override
  String get aiKeyDialogTitle => 'Gemini API 키';

  @override
  String get aiKeyDialogBody => '게스트 키는 저희 서버를 거치지 않고 Gemini에 직접 전달됩니다.';

  @override
  String get aiKeyHint => 'API 키를 입력하세요';

  @override
  String get aiKeySave => '저장';

  @override
  String get aiKeyClear => '키 삭제';

  @override
  String get aiSend => '보내기';

  @override
  String get aiInputHint => '무엇을 만들고 싶으세요?';

  @override
  String get aiPendingReviewTitle => 'AI가 제안한 변경';

  @override
  String get aiAccept => '적용';

  @override
  String get aiReject => '거절';

  @override
  String get aiTurnLocked => 'AI가 작업 중입니다…';

  @override
  String get aiEmptyState => 'AI에게 폼 만들기를 요청해 보세요.';

  @override
  String get publish => '배포';

  @override
  String get unpublish => '배포 취소';

  @override
  String get publishedBadge => '게시됨';

  @override
  String get publicUrl => '공개 URL';

  @override
  String get copyLink => '링크 복사';

  @override
  String get linkCopied => '링크가 복사되었습니다';

  @override
  String get viewResponses => '응답 보기';

  @override
  String get responsesTitle => '응답';

  @override
  String get exportCsv => 'CSV 내보내기';

  @override
  String get csvCopiedToClipboard => 'CSV가 클립보드에 복사되었습니다';

  @override
  String get noResponses => '아직 응답이 없습니다.';

  @override
  String get totalResponses => '총 응답 수';

  @override
  String get distributionTitle => '문항별 응답 분포';

  @override
  String get submittedAt => '제출 시각';

  @override
  String get guestCannotPublish => '게스트 폼은 배포할 수 없습니다. 먼저 로그인하세요.';
}
