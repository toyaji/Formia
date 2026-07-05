import 'package:form_factor/form_factor.dart';
import 'package:formia_core/formia_core.dart';
import 'package:formia_data/formia_data.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';

/// Guest [FormRepository]: privacy-first local storage (web IndexedDB via
/// Hive). No auto-restore — the caller decides whether to surface a restore
/// prompt (02 §5, `ui/shared/restore_draft_prompt.dart`).
class LocalDraftRepository implements FormRepository {
  static const boxName = 'guest_forms_v1';
  static const _uuid = Uuid();

  Future<Box<dynamic>> _box() => Hive.openBox<dynamic>(boxName);

  @override
  Future<Result<String>> create(FormFactor factor) async {
    try {
      final box = await _box();
      final id = _uuid.v4();
      await box.put(id, factor.toJson());
      return Result.ok(id);
    } on Object catch (e) {
      return Result.error(DataException('local_create_failed', cause: e));
    }
  }

  @override
  Future<Result<void>> save(String id, FormFactor factor) async {
    try {
      final box = await _box();
      await box.put(id, factor.toJson());
      return const Result.ok(null);
    } on Object catch (e) {
      return Result.error(DataException('local_save_failed', cause: e));
    }
  }

  @override
  Future<Result<FormFactor>> load(String id) async {
    try {
      final box = await _box();
      final raw = box.get(id);
      if (raw == null) {
        return Result.error(DataException('local_not_found'));
      }
      return Result.ok(FormFactor.fromJson(raw as Map));
    } on Object catch (e) {
      return Result.error(DataException('local_load_failed', cause: e));
    }
  }

  @override
  Future<Result<List<FormInfo>>> list() async {
    try {
      final box = await _box();
      final infos = box.keys.map((key) {
        final raw = box.get(key) as Map;
        final factor = FormFactor.fromJson(raw);
        return FormInfo(
          id: key as String,
          title: factor.metadata.title,
          updatedAt: DateTime.parse(factor.metadata.updatedAt),
        );
      }).toList()
        ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
      return Result.ok(infos);
    } on Object catch (e) {
      return Result.error(DataException('local_list_failed', cause: e));
    }
  }

  @override
  Future<Result<void>> delete(String id) async {
    try {
      final box = await _box();
      await box.delete(id);
      return const Result.ok(null);
    } on Object catch (e) {
      return Result.error(DataException('local_delete_failed', cause: e));
    }
  }

  /// Whether any guest draft exists — used to decide whether to show the
  /// restore prompt on entry (no auto-restore, 02 §5).
  static Future<bool> hasAnyDraft() async {
    final box = await Hive.openBox<dynamic>(boxName);
    return box.isNotEmpty;
  }
}
