import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:form_factor/form_factor.dart';
import 'package:formia_core/formia_core.dart';

import 'form_document_controller.dart';
import 'form_repository_provider.dart';

enum SaveStatus { idle, saving, saved, error }

/// `persistenceControllerProvider` (02 §2/§5): watches the document controller
/// and debounces saves. The document controller itself never calls save
/// directly — editing and persistence are separate concerns.
class PersistenceController extends FamilyNotifier<SaveStatus, String> {
  Timer? _debounce;

  @override
  SaveStatus build(String formId) {
    ref.listen(
      formDocumentControllerProvider(formId).select((s) => s.doc),
      (previous, next) {
        if (next == null || identical(previous, next)) return;
        _scheduleSave(formId, next);
      },
    );
    ref.onDispose(() => _debounce?.cancel());
    return SaveStatus.idle;
  }

  void _scheduleSave(String formId, FormFactor doc) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 900), () async {
      state = SaveStatus.saving;
      final repo = ref.read(formRepositoryProvider);
      final result = await repo.save(formId, doc);
      state = switch (result) {
        Ok() => SaveStatus.saved,
        Error() => SaveStatus.error,
      };
    });
  }
}

final persistenceControllerProvider =
    NotifierProvider.family<PersistenceController, SaveStatus, String>(
  PersistenceController.new,
);
