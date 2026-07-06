import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ko.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ko'),
    Locale('en'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In ko, this message translates to:
  /// **'Formia'**
  String get appTitle;

  /// No description provided for @loginTitle.
  ///
  /// In ko, this message translates to:
  /// **'Formia에 오신 것을 환영합니다'**
  String get loginTitle;

  /// No description provided for @loginWithGoogle.
  ///
  /// In ko, this message translates to:
  /// **'Google로 계속하기'**
  String get loginWithGoogle;

  /// No description provided for @continueAsGuest.
  ///
  /// In ko, this message translates to:
  /// **'게스트로 계속하기'**
  String get continueAsGuest;

  /// No description provided for @dashboardTitle.
  ///
  /// In ko, this message translates to:
  /// **'내 폼'**
  String get dashboardTitle;

  /// No description provided for @createForm.
  ///
  /// In ko, this message translates to:
  /// **'새 폼 만들기'**
  String get createForm;

  /// No description provided for @untitledForm.
  ///
  /// In ko, this message translates to:
  /// **'제목 없는 폼'**
  String get untitledForm;

  /// No description provided for @deleteForm.
  ///
  /// In ko, this message translates to:
  /// **'삭제'**
  String get deleteForm;

  /// No description provided for @deleteFormConfirm.
  ///
  /// In ko, this message translates to:
  /// **'이 폼을 삭제할까요? 되돌릴 수 없습니다.'**
  String get deleteFormConfirm;

  /// No description provided for @cancel.
  ///
  /// In ko, this message translates to:
  /// **'취소'**
  String get cancel;

  /// No description provided for @confirm.
  ///
  /// In ko, this message translates to:
  /// **'확인'**
  String get confirm;

  /// No description provided for @openForm.
  ///
  /// In ko, this message translates to:
  /// **'열기'**
  String get openForm;

  /// No description provided for @signOut.
  ///
  /// In ko, this message translates to:
  /// **'로그아웃'**
  String get signOut;

  /// No description provided for @emptyFormsList.
  ///
  /// In ko, this message translates to:
  /// **'아직 만든 폼이 없습니다.'**
  String get emptyFormsList;

  /// No description provided for @saveStatusIdle.
  ///
  /// In ko, this message translates to:
  /// **''**
  String get saveStatusIdle;

  /// No description provided for @saveStatusSaving.
  ///
  /// In ko, this message translates to:
  /// **'저장 중…'**
  String get saveStatusSaving;

  /// No description provided for @saveStatusSaved.
  ///
  /// In ko, this message translates to:
  /// **'저장됨'**
  String get saveStatusSaved;

  /// No description provided for @saveStatusError.
  ///
  /// In ko, this message translates to:
  /// **'저장 실패'**
  String get saveStatusError;

  /// No description provided for @undo.
  ///
  /// In ko, this message translates to:
  /// **'실행 취소'**
  String get undo;

  /// No description provided for @redo.
  ///
  /// In ko, this message translates to:
  /// **'다시 실행'**
  String get redo;

  /// No description provided for @addBlock.
  ///
  /// In ko, this message translates to:
  /// **'블록 추가'**
  String get addBlock;

  /// No description provided for @blockTypeText.
  ///
  /// In ko, this message translates to:
  /// **'단답형'**
  String get blockTypeText;

  /// No description provided for @blockTypeTextarea.
  ///
  /// In ko, this message translates to:
  /// **'장문형'**
  String get blockTypeTextarea;

  /// No description provided for @blockTypeChoice.
  ///
  /// In ko, this message translates to:
  /// **'객관식'**
  String get blockTypeChoice;

  /// No description provided for @blockTypeRating.
  ///
  /// In ko, this message translates to:
  /// **'평점'**
  String get blockTypeRating;

  /// No description provided for @blockTypeDate.
  ///
  /// In ko, this message translates to:
  /// **'날짜'**
  String get blockTypeDate;

  /// No description provided for @blockTypeFile.
  ///
  /// In ko, this message translates to:
  /// **'파일 업로드'**
  String get blockTypeFile;

  /// No description provided for @blockTypeInfo.
  ///
  /// In ko, this message translates to:
  /// **'안내문'**
  String get blockTypeInfo;

  /// No description provided for @blockTypeStatement.
  ///
  /// In ko, this message translates to:
  /// **'구분선/설명'**
  String get blockTypeStatement;

  /// No description provided for @deleteBlock.
  ///
  /// In ko, this message translates to:
  /// **'블록 삭제'**
  String get deleteBlock;

  /// No description provided for @viewportDesktop.
  ///
  /// In ko, this message translates to:
  /// **'데스크톱'**
  String get viewportDesktop;

  /// No description provided for @viewportMobile.
  ///
  /// In ko, this message translates to:
  /// **'모바일'**
  String get viewportMobile;

  /// No description provided for @previewToggle.
  ///
  /// In ko, this message translates to:
  /// **'미리보기'**
  String get previewToggle;

  /// No description provided for @editToggle.
  ///
  /// In ko, this message translates to:
  /// **'편집'**
  String get editToggle;

  /// No description provided for @restoreDraftTitle.
  ///
  /// In ko, this message translates to:
  /// **'임시 저장된 폼이 있습니다'**
  String get restoreDraftTitle;

  /// No description provided for @restoreDraftBody.
  ///
  /// In ko, this message translates to:
  /// **'이전에 게스트로 작업하던 폼을 이어서 편집할까요?'**
  String get restoreDraftBody;

  /// No description provided for @restoreDraftRestore.
  ///
  /// In ko, this message translates to:
  /// **'이어서 편집'**
  String get restoreDraftRestore;

  /// No description provided for @restoreDraftDiscard.
  ///
  /// In ko, this message translates to:
  /// **'새로 시작'**
  String get restoreDraftDiscard;

  /// No description provided for @pageStart.
  ///
  /// In ko, this message translates to:
  /// **'시작 페이지'**
  String get pageStart;

  /// No description provided for @pageQuestion.
  ///
  /// In ko, this message translates to:
  /// **'질문 페이지'**
  String get pageQuestion;

  /// No description provided for @pageEnding.
  ///
  /// In ko, this message translates to:
  /// **'종료 페이지'**
  String get pageEnding;

  /// No description provided for @questionLabel.
  ///
  /// In ko, this message translates to:
  /// **'질문'**
  String get questionLabel;

  /// No description provided for @helpText.
  ///
  /// In ko, this message translates to:
  /// **'도움말'**
  String get helpText;

  /// No description provided for @placeholder.
  ///
  /// In ko, this message translates to:
  /// **'안내 문구'**
  String get placeholder;

  /// No description provided for @choiceOptions.
  ///
  /// In ko, this message translates to:
  /// **'선택지 (쉼표로 구분)'**
  String get choiceOptions;

  /// No description provided for @multiSelect.
  ///
  /// In ko, this message translates to:
  /// **'복수 선택 허용'**
  String get multiSelect;

  /// No description provided for @ratingMax.
  ///
  /// In ko, this message translates to:
  /// **'최대 점수'**
  String get ratingMax;

  /// No description provided for @includeTime.
  ///
  /// In ko, this message translates to:
  /// **'시간 포함'**
  String get includeTime;

  /// No description provided for @acceptedTypes.
  ///
  /// In ko, this message translates to:
  /// **'허용 파일 형식 (쉼표로 구분)'**
  String get acceptedTypes;

  /// No description provided for @infoBody.
  ///
  /// In ko, this message translates to:
  /// **'안내 내용'**
  String get infoBody;

  /// No description provided for @loadError.
  ///
  /// In ko, this message translates to:
  /// **'폼을 불러오지 못했습니다'**
  String get loadError;

  /// No description provided for @genericError.
  ///
  /// In ko, this message translates to:
  /// **'오류가 발생했습니다'**
  String get genericError;

  /// No description provided for @aiPanelTitle.
  ///
  /// In ko, this message translates to:
  /// **'AI 도우미'**
  String get aiPanelTitle;

  /// No description provided for @aiKeySettings.
  ///
  /// In ko, this message translates to:
  /// **'AI 키 설정'**
  String get aiKeySettings;

  /// No description provided for @aiKeyDialogTitle.
  ///
  /// In ko, this message translates to:
  /// **'Gemini API 키'**
  String get aiKeyDialogTitle;

  /// No description provided for @aiKeyDialogBody.
  ///
  /// In ko, this message translates to:
  /// **'게스트 키는 저희 서버를 거치지 않고 Gemini에 직접 전달됩니다.'**
  String get aiKeyDialogBody;

  /// No description provided for @aiKeyHint.
  ///
  /// In ko, this message translates to:
  /// **'API 키를 입력하세요'**
  String get aiKeyHint;

  /// No description provided for @aiKeySave.
  ///
  /// In ko, this message translates to:
  /// **'저장'**
  String get aiKeySave;

  /// No description provided for @aiKeyClear.
  ///
  /// In ko, this message translates to:
  /// **'키 삭제'**
  String get aiKeyClear;

  /// No description provided for @aiSend.
  ///
  /// In ko, this message translates to:
  /// **'보내기'**
  String get aiSend;

  /// No description provided for @aiInputHint.
  ///
  /// In ko, this message translates to:
  /// **'무엇을 만들고 싶으세요?'**
  String get aiInputHint;

  /// No description provided for @aiPendingReviewTitle.
  ///
  /// In ko, this message translates to:
  /// **'AI가 제안한 변경'**
  String get aiPendingReviewTitle;

  /// No description provided for @aiAccept.
  ///
  /// In ko, this message translates to:
  /// **'적용'**
  String get aiAccept;

  /// No description provided for @aiReject.
  ///
  /// In ko, this message translates to:
  /// **'거절'**
  String get aiReject;

  /// No description provided for @aiTurnLocked.
  ///
  /// In ko, this message translates to:
  /// **'AI가 작업 중입니다…'**
  String get aiTurnLocked;

  /// No description provided for @aiEmptyState.
  ///
  /// In ko, this message translates to:
  /// **'AI에게 폼 만들기를 요청해 보세요.'**
  String get aiEmptyState;

  /// No description provided for @publish.
  ///
  /// In ko, this message translates to:
  /// **'배포'**
  String get publish;

  /// No description provided for @unpublish.
  ///
  /// In ko, this message translates to:
  /// **'배포 취소'**
  String get unpublish;

  /// No description provided for @publishedBadge.
  ///
  /// In ko, this message translates to:
  /// **'게시됨'**
  String get publishedBadge;

  /// No description provided for @publicUrl.
  ///
  /// In ko, this message translates to:
  /// **'공개 URL'**
  String get publicUrl;

  /// No description provided for @copyLink.
  ///
  /// In ko, this message translates to:
  /// **'링크 복사'**
  String get copyLink;

  /// No description provided for @linkCopied.
  ///
  /// In ko, this message translates to:
  /// **'링크가 복사되었습니다'**
  String get linkCopied;

  /// No description provided for @viewResponses.
  ///
  /// In ko, this message translates to:
  /// **'응답 보기'**
  String get viewResponses;

  /// No description provided for @responsesTitle.
  ///
  /// In ko, this message translates to:
  /// **'응답'**
  String get responsesTitle;

  /// No description provided for @exportCsv.
  ///
  /// In ko, this message translates to:
  /// **'CSV 내보내기'**
  String get exportCsv;

  /// No description provided for @csvCopiedToClipboard.
  ///
  /// In ko, this message translates to:
  /// **'CSV가 클립보드에 복사되었습니다'**
  String get csvCopiedToClipboard;

  /// No description provided for @noResponses.
  ///
  /// In ko, this message translates to:
  /// **'아직 응답이 없습니다.'**
  String get noResponses;

  /// No description provided for @totalResponses.
  ///
  /// In ko, this message translates to:
  /// **'총 응답 수'**
  String get totalResponses;

  /// No description provided for @distributionTitle.
  ///
  /// In ko, this message translates to:
  /// **'문항별 응답 분포'**
  String get distributionTitle;

  /// No description provided for @submittedAt.
  ///
  /// In ko, this message translates to:
  /// **'제출 시각'**
  String get submittedAt;

  /// No description provided for @guestCannotPublish.
  ///
  /// In ko, this message translates to:
  /// **'게스트 폼은 배포할 수 없습니다. 먼저 로그인하세요.'**
  String get guestCannotPublish;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ko'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'ko':
      return AppLocalizationsKo();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
