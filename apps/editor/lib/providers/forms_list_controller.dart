import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:formia_core/formia_core.dart';
import 'package:formia_data/formia_data.dart';

import '../service/blank_form.dart';
import 'form_repository_provider.dart';

/// Dashboard's form list (02 §2 `formsListControllerProvider`). Wraps
/// [FormRepository.list]/`create`/`delete`; the widget only watches
/// `AsyncValue<List<FormInfo>>` and calls the controller's methods.
class FormsListController extends AsyncNotifier<List<FormInfo>> {
  @override
  Future<List<FormInfo>> build() async {
    final repo = ref.watch(formRepositoryProvider);
    final result = await repo.list();
    return switch (result) {
      Ok(:final value) => value,
      Error(:final error) => throw error,
    };
  }

  Future<void> refresh() async {
    ref.invalidateSelf();
    await future;
  }

  /// Creates a new blank form and returns its id, or `null` on failure.
  Future<String?> createBlank() async {
    final repo = ref.read(formRepositoryProvider);
    final result = await repo.create(blankFormFactor());
    final id = switch (result) {
      Ok(:final value) => value,
      Error() => null,
    };
    if (id != null) await refresh();
    return id;
  }

  Future<bool> delete(String id) async {
    final repo = ref.read(formRepositoryProvider);
    final result = await repo.delete(id);
    final ok = result is Ok<void>;
    if (ok) await refresh();
    return ok;
  }
}

final formsListControllerProvider =
    AsyncNotifierProvider<FormsListController, List<FormInfo>>(
  FormsListController.new,
);
