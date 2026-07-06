import 'package:formia_core/formia_core.dart';

/// Context about a public form submission (stored alongside the answers).
class ResponseMeta {
  const ResponseMeta({this.referrer, this.durationMs, this.userAgent});
  final String? referrer;
  final int? durationMs;
  final String? userAgent;

  Map<String, Object?> toJson() => {
        if (referrer != null) 'referrer': referrer,
        if (durationMs != null) 'durationMs': durationMs,
        if (userAgent != null) 'userAgent': userAgent,
      };
}

/// One stored response row, for the owner's response dashboard (03 §6).
class ResponseRecord {
  const ResponseRecord({
    required this.id,
    required this.data,
    required this.submittedAt,
    this.metadata,
  });

  final String id;
  final Map<String, Object?> data;
  final Map<String, Object?>? metadata;
  final DateTime submittedAt;
}

/// Submits anonymous responses for a published form, and (owner-only) lists
/// them for the response dashboard. Submission goes through the
/// `submit-response` edge function (never a direct table insert), which
/// enforces rate limiting / size caps / published checks (03 §2, §5).
/// `list` reads the `responses` table directly — RLS restricts it to the
/// form's owner (03 §2 `responses_owner_read`).
abstract interface class ResponseRepository {
  Future<Result<void>> submit(
    String shortId,
    Map<String, Object?> answers,
    ResponseMeta meta,
  );

  Future<Result<List<ResponseRecord>>> list(String formId);
}
