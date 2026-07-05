/// Errors surfaced by the data layer (wrapped in `Result.error`).
class DataException implements Exception {
  const DataException(this.message, {this.cause});
  final String message;
  final Object? cause;

  @override
  String toString() => 'DataException($message${cause == null ? '' : ', $cause'})';
}

class NotAuthenticatedException extends DataException {
  const NotAuthenticatedException() : super('not_authenticated');
}
