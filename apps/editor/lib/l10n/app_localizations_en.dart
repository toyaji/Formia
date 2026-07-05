// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Formia';

  @override
  String get loginTitle => 'Welcome to Formia';

  @override
  String get loginWithGoogle => 'Continue with Google';

  @override
  String get continueAsGuest => 'Continue as guest';

  @override
  String get dashboardTitle => 'My forms';

  @override
  String get createForm => 'New form';

  @override
  String get untitledForm => 'Untitled form';

  @override
  String get deleteForm => 'Delete';

  @override
  String get deleteFormConfirm => 'Delete this form? This cannot be undone.';

  @override
  String get cancel => 'Cancel';

  @override
  String get confirm => 'Confirm';

  @override
  String get openForm => 'Open';

  @override
  String get signOut => 'Sign out';

  @override
  String get emptyFormsList => 'You haven\'t created any forms yet.';

  @override
  String get saveStatusIdle => '';

  @override
  String get saveStatusSaving => 'Saving…';

  @override
  String get saveStatusSaved => 'Saved';

  @override
  String get saveStatusError => 'Save failed';

  @override
  String get undo => 'Undo';

  @override
  String get redo => 'Redo';

  @override
  String get addBlock => 'Add block';

  @override
  String get blockTypeText => 'Short text';

  @override
  String get blockTypeTextarea => 'Long text';

  @override
  String get blockTypeChoice => 'Choice';

  @override
  String get blockTypeRating => 'Rating';

  @override
  String get blockTypeDate => 'Date';

  @override
  String get blockTypeFile => 'File upload';

  @override
  String get blockTypeInfo => 'Info';

  @override
  String get blockTypeStatement => 'Statement';

  @override
  String get deleteBlock => 'Delete block';

  @override
  String get viewportDesktop => 'Desktop';

  @override
  String get viewportMobile => 'Mobile';

  @override
  String get previewToggle => 'Preview';

  @override
  String get editToggle => 'Edit';

  @override
  String get restoreDraftTitle => 'You have a saved draft';

  @override
  String get restoreDraftBody =>
      'Continue editing your guest draft from before?';

  @override
  String get restoreDraftRestore => 'Restore';

  @override
  String get restoreDraftDiscard => 'Start fresh';

  @override
  String get pageStart => 'Start page';

  @override
  String get pageQuestion => 'Question page';

  @override
  String get pageEnding => 'Ending page';

  @override
  String get questionLabel => 'Question';

  @override
  String get helpText => 'Help text';

  @override
  String get placeholder => 'Placeholder';

  @override
  String get choiceOptions => 'Options (comma-separated)';

  @override
  String get multiSelect => 'Allow multiple selection';

  @override
  String get ratingMax => 'Max rating';

  @override
  String get includeTime => 'Include time';

  @override
  String get acceptedTypes => 'Accepted file types (comma-separated)';

  @override
  String get infoBody => 'Body';

  @override
  String get loadError => 'Failed to load form';

  @override
  String get genericError => 'Something went wrong';
}
