import 'package:formia_core/formia_core.dart';
import 'package:test/test.dart';

void main() {
  group('Result', () {
    test('Ok exposes value and null error', () {
      const result = Result<int>.ok(42);
      expect(result.value, 42);
      expect(result.error, isNull);
      expect(result, isA<Ok<int>>());
    });

    test('Error exposes error and null value', () {
      final result = Result<int>.error(Exception('boom'));
      expect(result.value, isNull);
      expect(result.error, isA<Exception>());
      expect(result, isA<Error<int>>());
    });

    test('switch pattern matching works', () {
      const result = Result<String>.ok('hello');
      final matched = switch (result) {
        Ok(:final value) => value,
        Error() => 'error',
      };
      expect(matched, 'hello');
    });
  });
}
