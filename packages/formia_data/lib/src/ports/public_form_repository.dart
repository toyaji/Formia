import 'package:form_factor/form_factor.dart';
import 'package:formia_core/formia_core.dart';

/// Anonymous read access to a published form's factor (04 doc §2). The only
/// Port `apps/public_form` depends on besides [ResponseRepository] — it must
/// never see owner info or unpublished/draft forms (enforced server-side by
/// the `get_public_form` RPC's projection, 03 §1).
abstract interface class PublicFormRepository {
  Future<Result<FormFactor>> getPublicForm(String shortId);
}
