import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:formia_core/formia_core.dart';
import 'package:formia_data/formia_data.dart';

import 'response_repository_provider.dart';

/// Owner-side response list for the response dashboard (03 §6).
class ResponsesController extends FamilyAsyncNotifier<List<ResponseRecord>, String> {
  @override
  Future<List<ResponseRecord>> build(String formId) async {
    final repo = ref.watch(responseRepositoryProvider);
    final result = await repo.list(formId);
    return switch (result) {
      Ok(:final value) => value,
      Error(:final error) => throw error,
    };
  }

  Future<void> refresh() async {
    ref.invalidateSelf();
    await future;
  }
}

final responsesControllerProvider =
    AsyncNotifierProvider.family<ResponsesController, List<ResponseRecord>, String>(
  ResponsesController.new,
);
