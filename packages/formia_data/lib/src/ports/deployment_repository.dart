import 'package:formia_core/formia_core.dart';

/// A form's public-deployment state (03 §5, 06 doc DoD: publish -> public URL).
class DeploymentStatus {
  const DeploymentStatus({required this.status, this.shortId, this.publishedAt});

  final String status; // draft | published | archived
  final String? shortId;
  final DateTime? publishedAt;

  bool get isPublished => status == 'published' && shortId != null;
}

/// Publishes/unpublishes a form for public access at `/p/<shortId>` (04 doc).
/// Only meaningful for logged-in owners — guest forms are never public, so
/// there is no guest implementation of this port.
abstract interface class DeploymentRepository {
  Future<Result<DeploymentStatus>> publish(String formId);
  Future<Result<void>> unpublish(String formId);
}
