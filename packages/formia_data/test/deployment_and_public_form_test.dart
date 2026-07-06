@TestOn('vm')
library;

import 'dart:io';

import 'package:form_factor/form_factor.dart';
import 'package:formia_core/formia_core.dart';
import 'package:formia_data/formia_data.dart';
import 'package:supabase/supabase.dart';
import 'package:test/test.dart';

/// Integration test against a LOCAL Supabase stack (see
/// supabase_form_repository_test.dart for the env var contract). Exercises
/// the full Phase 6 publish -> public fetch -> submit -> owner-list loop.
void main() {
  final env = Platform.environment;
  final url = env['SUPABASE_URL'] ?? '';
  final anonKey = env['SUPABASE_ANON_KEY'] ?? '';
  final service = env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

  final configured = url.isNotEmpty && anonKey.isNotEmpty && service.isNotEmpty;

  group(
    'Deployment + public form + responses (local stack)',
    skip: configured ? false : 'set SUPABASE_URL/ANON/SERVICE env',
    () {
      late SupabaseClient admin;
      late SupabaseClient owner;
      late SupabaseClient anon;
      late SupabaseFormRepository formRepo;
      late SupabaseDeploymentRepository deploymentRepo;
      late SupabasePublicFormRepository publicFormRepo;
      late SupabaseResponseRepository ownerResponses;
      late SupabaseResponseRepository anonResponses;
      late String userId;
      final email = 'itest_deploy_${DateTime.now().millisecondsSinceEpoch}@example.com';
      const password = 'password123!';

      setUpAll(() async {
        admin = SupabaseClient(url, service);
        final created = await admin.auth.admin.createUser(
          AdminUserAttributes(email: email, password: password, emailConfirm: true),
        );
        userId = created.user!.id;

        owner = SupabaseClient(url, anonKey);
        await owner.auth.signInWithPassword(email: email, password: password);

        anon = SupabaseClient(url, anonKey);

        formRepo = SupabaseFormRepository(owner);
        deploymentRepo = SupabaseDeploymentRepository(owner);
        publicFormRepo = SupabasePublicFormRepository(anon);
        ownerResponses = SupabaseResponseRepository(owner);
        anonResponses = SupabaseResponseRepository(anon);
      });

      tearDownAll(() async {
        await admin.auth.admin.deleteUser(userId);
        await admin.dispose();
        await owner.dispose();
        await anon.dispose();
      });

      FormFactor sample(String title) => FormFactor(
            metadata: FormMetadata(
              title: title,
              createdAt: DateTime.now().toIso8601String(),
              updatedAt: DateTime.now().toIso8601String(),
            ),
            pages: [
              const FormPage(id: 's', role: PageRole.start, title: '시작', locked: true),
              FormPage(
                id: 'q1',
                role: PageRole.question,
                title: '질문',
                blocks: const [
                  FormBlock(id: 'b1', content: TextContent(label: '이름')),
                ],
              ),
              const FormPage(id: 'e', role: PageRole.ending, title: '종료', locked: true),
            ],
          );

      test('publish -> anon fetch -> submit -> owner list -> unpublish', () async {
        final created = await formRepo.create(sample('배포 테스트 폼'));
        final formId = created.value!;

        // Publish.
        final published = await deploymentRepo.publish(formId);
        expect(published, isA<Ok<DeploymentStatus>>());
        final shortId = published.value!.shortId!;
        expect(published.value!.isPublished, isTrue);

        // Re-publishing reuses the same short_id.
        final republished = await deploymentRepo.publish(formId);
        expect(republished.value!.shortId, shortId);

        // Anon can fetch the published factor via the RPC projection.
        final fetched = await publicFormRepo.getPublicForm(shortId);
        expect(fetched, isA<Ok<FormFactor>>());
        expect(fetched.value!.metadata.title, '배포 테스트 폼');

        // Anon submits a response through submit-response (edge function).
        final submitted = await anonResponses.submit(shortId, {'b1': '홍길동'}, const ResponseMeta());
        expect(submitted, isA<Ok<void>>(), reason: submitted.error?.toString());

        // Owner can list the response; anon cannot read the table directly
        // (RLS `responses_owner_read`), which SupabaseResponseRepository.list
        // doesn't special-case — it just returns empty/denied for anon.
        final listed = await ownerResponses.list(formId);
        expect(listed.value, isNotNull);
        expect(listed.value!.any((r) => r.data['b1'] == '홍길동'), isTrue);

        // Unpublish makes the public RPC stop returning the form.
        final unpublished = await deploymentRepo.unpublish(formId);
        expect(unpublished, isA<Ok<void>>());
        final afterUnpublish = await publicFormRepo.getPublicForm(shortId);
        expect(afterUnpublish, isA<Error<FormFactor>>());

        await formRepo.delete(formId);
      });
    },
  );
}
