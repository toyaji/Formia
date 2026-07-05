/// Pure evaluation of a form's [FormLogic] against a set of answers.
///
/// The editor preview and the Jaspr public renderer share this evaluator so
/// branching/visibility behave identically (01 §3).
library;

import '../model/enums.dart';
import '../model/form_factor.dart';
import '../model/logic.dart';

class LogicOutcome {
  const LogicOutcome({this.hiddenBlockIds = const {}, this.jumpToPageId});

  /// Blocks that should be hidden given the current answers.
  final Set<String> hiddenBlockIds;

  /// The page to navigate to, if a jump rule fired (first firing wins).
  final String? jumpToPageId;

  bool isBlockVisible(String blockId) => !hiddenBlockIds.contains(blockId);
}

class LogicEvaluator {
  const LogicEvaluator();

  /// Evaluates all rules against [answers] (blockId → value).
  LogicOutcome evaluate(FormFactor factor, Map<String, Object?> answers) {
    final hidden = <String>{};
    String? jump;

    for (final rule in factor.logic.rules) {
      if (!_matches(rule.when, answers)) continue;
      for (final action in rule.then) {
        switch (action) {
          case HideBlockAction(:final blockId):
            hidden.add(blockId);
          case ShowBlockAction(:final blockId):
            hidden.remove(blockId);
          case JumpToPageAction(:final pageId):
            jump ??= pageId;
        }
      }
    }
    return LogicOutcome(hiddenBlockIds: hidden, jumpToPageId: jump);
  }

  bool _matches(LogicCondition c, Map<String, Object?> answers) {
    switch (c) {
      case AndCondition(:final all):
        return all.every((e) => _matches(e, answers));
      case OrCondition(:final any):
        return any.any((e) => _matches(e, answers));
      case BlockAnswerCondition(:final blockId, :final op, :final value):
        return _compare(answers[blockId], op, value);
    }
  }

  bool _compare(Object? answer, ConditionOperator op, Object? value) {
    switch (op) {
      case ConditionOperator.equals:
        return answer == value;
      case ConditionOperator.notEquals:
        return answer != value;
      case ConditionOperator.contains:
        if (answer is Iterable) return answer.contains(value);
        if (answer is String && value is String) return answer.contains(value);
        return false;
      case ConditionOperator.gt:
        final a = _asNum(answer), b = _asNum(value);
        return a != null && b != null && a > b;
      case ConditionOperator.lt:
        final a = _asNum(answer), b = _asNum(value);
        return a != null && b != null && a < b;
      case ConditionOperator.isEmpty:
        return _isEmpty(answer);
      case ConditionOperator.isNotEmpty:
        return !_isEmpty(answer);
    }
  }

  bool _isEmpty(Object? v) {
    if (v == null) return true;
    if (v is String) return v.isEmpty;
    if (v is Iterable) return v.isEmpty;
    if (v is Map) return v.isEmpty;
    return false;
  }

  num? _asNum(Object? v) {
    if (v is num) return v;
    if (v is String) return num.tryParse(v);
    return null;
  }
}
