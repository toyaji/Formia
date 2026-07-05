import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:form_factor/form_factor.dart';
import 'package:formia_core/formia_core.dart';
import 'package:formia_data/formia_data.dart';

import 'form_repository_provider.dart';

/// State for `formDocumentControllerProvider` (02 §2/§3): the loaded
/// [DocHistory] (doc + undo/redo stacks), or a loading/error flag while the
/// initial `load` is in flight.
class FormDocState {
  const FormDocState({this.history, this.loading = false, this.error});

  final DocHistory? history;
  final bool loading;
  final Object? error;

  FormFactor? get doc => history?.doc;
  bool get canUndo => history?.canUndo ?? false;
  bool get canRedo => history?.canRedo ?? false;

  FormDocState copyWith({DocHistory? history, bool? loading, Object? error}) =>
      FormDocState(
        history: history ?? this.history,
        loading: loading ?? this.loading,
        error: error,
      );
}

/// Owns the current [FormFactor] + edit history for one form. Presentation
/// widgets never mutate the document directly — only via [execute] (02 §1).
class FormDocumentController extends FamilyNotifier<FormDocState, String> {
  @override
  FormDocState build(String formId) {
    final repo = ref.watch(formRepositoryProvider);
    _load(repo, formId);
    return const FormDocState(loading: true);
  }

  Future<void> _load(FormRepository repo, String formId) async {
    final result = await repo.load(formId);
    state = switch (result) {
      Ok(:final value) => FormDocState(history: DocHistory(doc: value)),
      Error(:final error) => FormDocState(error: error),
    };
  }

  /// Executes one edit command. If it violates a domain invariant, the
  /// exception is surfaced via [FormDocState.error] and the document is left
  /// unchanged (history is atomic — see `AiTurnCommand`).
  void execute(FormCommand cmd) {
    final history = state.history;
    if (history == null) return;
    try {
      state = state.copyWith(history: history.execute(cmd), error: null);
    } on FormFactorViolation catch (e) {
      state = state.copyWith(error: e);
    }
  }

  void undo() {
    final history = state.history;
    if (history == null || !history.canUndo) return;
    state = state.copyWith(history: history.undo());
  }

  void redo() {
    final history = state.history;
    if (history == null || !history.canRedo) return;
    state = state.copyWith(history: history.redo());
  }
}

final formDocumentControllerProvider =
    NotifierProvider.family<FormDocumentController, FormDocState, String>(
  FormDocumentController.new,
);
