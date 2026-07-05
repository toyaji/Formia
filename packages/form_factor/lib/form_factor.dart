/// Pure Dart domain package for the Formia Form Factor v3 model.
///
/// Contains the immutable model, structural invariants, and (in later tasks)
/// validation, migration, commands, and logic evaluation.
/// See `docs/flutter_migration/01-form-factor-v3.md`.
library;

export 'src/model/block.dart';
export 'src/model/block_content.dart';
export 'src/model/choice_option.dart';
export 'src/model/enums.dart';
export 'src/model/exceptions.dart';
export 'src/model/form_factor.dart';
export 'src/model/logic.dart';
export 'src/model/page.dart';
export 'src/model/theme.dart';
export 'src/logic/logic_evaluator.dart';
export 'src/validation/validation_error.dart';
export 'src/validation/validator.dart';
export 'src/command/commands.dart';
export 'src/command/history.dart';
export 'src/migration/migrator.dart';
