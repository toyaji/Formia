import 'package:form_factor/form_factor.dart';
import 'package:formia_core/formia_core.dart';

/// Summary row for the dashboard list.
class FormInfo {
  const FormInfo({
    required this.id,
    required this.title,
    required this.updatedAt,
    this.deployment,
  });

  final String id;
  final String title;
  final DateTime updatedAt;
  final DeploymentInfo? deployment;
}

class DeploymentInfo {
  const DeploymentInfo({required this.status, this.shortId});
  final String status;
  final String? shortId;

  bool get isPublished => status == 'published' && shortId != null;
}

/// The editor's only view of persistence. Implementations (Supabase, local
/// draft, desktop file, hybrid) are injected. All methods return [Result]
/// instead of throwing (house style, ADR-8).
abstract interface class FormRepository {
  /// Creates a new form, returning its generated id.
  Future<Result<String>> create(FormFactor factor);

  /// Overwrites an existing form.
  Future<Result<void>> save(String id, FormFactor factor);

  /// Loads a form by id.
  Future<Result<FormFactor>> load(String id);

  /// Lists the current context's forms (most-recent first).
  Future<Result<List<FormInfo>>> list();

  /// Deletes a form.
  Future<Result<void>> delete(String id);
}
