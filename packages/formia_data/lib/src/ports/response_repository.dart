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

/// Submits anonymous responses for a published form. Implementations go through
/// the `submit-response` edge function (never a direct table insert), which
/// enforces rate limiting / size caps / published checks (03 §2, §5).
abstract interface class ResponseRepository {
  Future<Result<void>> submit(
    String shortId,
    Map<String, Object?> answers,
    ResponseMeta meta,
  );
}
