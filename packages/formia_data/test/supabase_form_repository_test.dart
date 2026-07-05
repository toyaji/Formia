@TestOn('vm')
library;

import 'dart:io';

import 'package:form_factor/form_factor.dart';
import 'package:formia_core/formia_core.dart';
import 'package:formia_data/formia_data.dart';
import 'package:supabase/supabase.dart';
import 'package:test/test.dart';

/// Integration test against a LOCAL Supabase stack. Skipped unless the env
/// vars are present:
///   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
/// Run: `dart test` after exporting those (see task-briefs / supabase status).
void main() {
  final env = Platform.environment;
  final url = env['SUPABASE_URL'] ?? '';
  final anon = env['SUPABASE_ANON_KEY'] ?? '';
  final service = env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

  final configured = url.isNotEmpty && anon.isNotEmpty && service.isNotEmpty;

  group('SupabaseFormRepository (local stack)', skip: configured ? false : 'set SUPABASE_URL/ANON/SERVICE env', () {
    late SupabaseClient admin;
    late SupabaseClient user;
    late SupabaseFormRepository repo;
    late String userId;
    final email = 'itest_${DateTime.now().millisecondsSinceEpoch}@example.com';
    const password = 'password123!';

    setUpAll(() async {
      admin = SupabaseClient(url, service);
      final created = await admin.auth.admin.createUser(AdminUserAttributes(
        email: email,
        password: password,
        emailConfirm: true,
      ));
      userId = created.user!.id;

      user = SupabaseClient(url, anon);
      await user.auth.signInWithPassword(email: email, password: password);
      repo = SupabaseFormRepository(user);
    });

    tearDownAll(() async {
      await admin.auth.admin.deleteUser(userId);
      await admin.dispose();
      await user.dispose();
    });

    FormFactor sample(String title) => FormFactor(
          metadata: FormMetadata(
            title: title,
            createdAt: DateTime.now().toIso8601String(),
            updatedAt: DateTime.now().toIso8601String(),
          ),
          pages: const [
            FormPage(id: 's', role: PageRole.start, title: '시작', locked: true),
            FormPage(id: 'e', role: PageRole.ending, title: '종료', locked: true),
          ],
        );

    test('create -> load -> save -> list -> delete round trip', () async {
      // create
      final created = await repo.create(sample('내 설문'));
      expect(created, isA<Ok<String>>());
      final id = created.value!;

      // load
      final loaded = await repo.load(id);
      expect(loaded.value?.metadata.title, '내 설문');

      // save (rename)
      final ok = await repo.save(id, sample('수정된 설문'));
      expect(ok, isA<Ok<void>>());
      final reloaded = await repo.load(id);
      expect(reloaded.value?.metadata.title, '수정된 설문');

      // list contains it
      final listed = await repo.list();
      expect(listed.value!.any((f) => f.id == id), isTrue);

      // delete
      final del = await repo.delete(id);
      expect(del, isA<Ok<void>>());
      final gone = await repo.load(id);
      expect(gone, isA<Error<FormFactor>>(), reason: 'load after delete fails');
    });

    test('list shows deployment info after publish', () async {
      final created = await repo.create(sample('배포 설문'));
      final id = created.value!;
      // Publish via admin (bypasses RLS) — mimics the publish action.
      await admin.from('deployments').insert({
        'form_id': id,
        'status': 'published',
        'short_id': 'itest_${DateTime.now().millisecondsSinceEpoch}',
        'published_at': DateTime.now().toIso8601String(),
      });
      final listed = await repo.list();
      final info = listed.value!.firstWhere((f) => f.id == id);
      expect(info.deployment?.status, 'published');
      await repo.delete(id);
    });
  });
}
