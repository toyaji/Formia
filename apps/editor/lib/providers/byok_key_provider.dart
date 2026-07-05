import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

/// Guest BYOK Gemini key (07 §2/§6): held only on this device, used to talk
/// to Gemini **directly** (never through `llm-proxy`) so it never touches
/// our servers. The logged-in/Vault path is a separate server-side loop
/// (07 §2 note) and is out of scope here.
class ByokKeyController extends Notifier<String?> {
  static const boxName = 'ai_keys_v1';
  static const _key = 'gemini';

  Box<String> get _box => Hive.box<String>(boxName);

  @override
  String? build() => _box.get(_key);

  Future<void> setKey(String key) async {
    await _box.put(_key, key);
    state = key;
  }

  Future<void> clear() async {
    await _box.delete(_key);
    state = null;
  }
}

final byokKeyProvider = NotifierProvider<ByokKeyController, String?>(
  ByokKeyController.new,
);
