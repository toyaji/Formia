/// Branching / visibility logic (data model only — evaluation lives in
/// `LogicEvaluator`, a later task).
///
/// Conditions and actions are sealed hierarchies with `type`-discriminated
/// hand-written JSON (see `docs/flutter_migration/01-form-factor-v3.md#3`).
library;

import 'package:meta/meta.dart';

import 'enums.dart';
import 'exceptions.dart';

@immutable
class FormLogic {
  const FormLogic({this.rules = const []});

  final List<LogicRule> rules;

  FormLogic copyWith({List<LogicRule>? rules}) =>
      FormLogic(rules: rules ?? this.rules);

  factory FormLogic.fromJson(Map<String, dynamic> json) => FormLogic(
        rules: (json['rules'] as List<dynamic>?)
                ?.map((e) => LogicRule.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
      );

  Map<String, dynamic> toJson() =>
      {'rules': rules.map((e) => e.toJson()).toList()};
}

@immutable
class LogicRule {
  const LogicRule({required this.id, required this.when, required this.then});

  final String id;
  final LogicCondition when;
  final List<LogicAction> then;

  LogicRule copyWith({String? id, LogicCondition? when, List<LogicAction>? then}) =>
      LogicRule(
        id: id ?? this.id,
        when: when ?? this.when,
        then: then ?? this.then,
      );

  factory LogicRule.fromJson(Map<String, dynamic> json) => LogicRule(
        id: json['id'] as String,
        when: LogicCondition.fromJson(json['when'] as Map<String, dynamic>),
        then: (json['then'] as List<dynamic>)
            .map((e) => LogicAction.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'when': when.toJson(),
        'then': then.map((e) => e.toJson()).toList(),
      };
}

// ─── Conditions ─────────────────────────────────────────────────────────

@immutable
sealed class LogicCondition {
  const LogicCondition();

  String get type;
  Map<String, dynamic> toJson();

  factory LogicCondition.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String?;
    switch (type) {
      case 'blockAnswer':
        return BlockAnswerCondition.fromJson(json);
      case 'and':
        return AndCondition.fromJson(json);
      case 'or':
        return OrCondition.fromJson(json);
      default:
        throw FormFactorViolation('logic.condition.unknownType', {'type': type});
    }
  }
}

@immutable
class BlockAnswerCondition extends LogicCondition {
  const BlockAnswerCondition({
    required this.blockId,
    required this.op,
    this.value,
  });

  final String blockId;
  final ConditionOperator op;
  final Object? value;

  @override
  String get type => 'blockAnswer';

  BlockAnswerCondition copyWith({
    String? blockId,
    ConditionOperator? op,
    Object? value,
  }) =>
      BlockAnswerCondition(
        blockId: blockId ?? this.blockId,
        op: op ?? this.op,
        value: value ?? this.value,
      );

  factory BlockAnswerCondition.fromJson(Map<String, dynamic> json) =>
      BlockAnswerCondition(
        blockId: json['blockId'] as String,
        op: ConditionOperator.fromJson(json['op'] as String),
        value: json['value'],
      );

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        'blockId': blockId,
        'op': op.toJson(),
        if (value != null) 'value': value,
      };
}

@immutable
class AndCondition extends LogicCondition {
  const AndCondition({required this.all});

  final List<LogicCondition> all;

  @override
  String get type => 'and';

  AndCondition copyWith({List<LogicCondition>? all}) =>
      AndCondition(all: all ?? this.all);

  factory AndCondition.fromJson(Map<String, dynamic> json) => AndCondition(
        all: (json['all'] as List<dynamic>)
            .map((e) => LogicCondition.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  @override
  Map<String, dynamic> toJson() =>
      {'type': type, 'all': all.map((e) => e.toJson()).toList()};
}

@immutable
class OrCondition extends LogicCondition {
  const OrCondition({required this.any});

  final List<LogicCondition> any;

  @override
  String get type => 'or';

  OrCondition copyWith({List<LogicCondition>? any}) =>
      OrCondition(any: any ?? this.any);

  factory OrCondition.fromJson(Map<String, dynamic> json) => OrCondition(
        any: (json['any'] as List<dynamic>)
            .map((e) => LogicCondition.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  @override
  Map<String, dynamic> toJson() =>
      {'type': type, 'any': any.map((e) => e.toJson()).toList()};
}

// ─── Actions ────────────────────────────────────────────────────────────

@immutable
sealed class LogicAction {
  const LogicAction();

  String get type;
  Map<String, dynamic> toJson();

  factory LogicAction.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String?;
    switch (type) {
      case 'jumpToPage':
        return JumpToPageAction.fromJson(json);
      case 'showBlock':
        return ShowBlockAction.fromJson(json);
      case 'hideBlock':
        return HideBlockAction.fromJson(json);
      default:
        throw FormFactorViolation('logic.action.unknownType', {'type': type});
    }
  }
}

@immutable
class JumpToPageAction extends LogicAction {
  const JumpToPageAction({required this.pageId});

  final String pageId;

  @override
  String get type => 'jumpToPage';

  JumpToPageAction copyWith({String? pageId}) =>
      JumpToPageAction(pageId: pageId ?? this.pageId);

  factory JumpToPageAction.fromJson(Map<String, dynamic> json) =>
      JumpToPageAction(pageId: json['pageId'] as String);

  @override
  Map<String, dynamic> toJson() => {'type': type, 'pageId': pageId};
}

@immutable
class ShowBlockAction extends LogicAction {
  const ShowBlockAction({required this.blockId});

  final String blockId;

  @override
  String get type => 'showBlock';

  ShowBlockAction copyWith({String? blockId}) =>
      ShowBlockAction(blockId: blockId ?? this.blockId);

  factory ShowBlockAction.fromJson(Map<String, dynamic> json) =>
      ShowBlockAction(blockId: json['blockId'] as String);

  @override
  Map<String, dynamic> toJson() => {'type': type, 'blockId': blockId};
}

@immutable
class HideBlockAction extends LogicAction {
  const HideBlockAction({required this.blockId});

  final String blockId;

  @override
  String get type => 'hideBlock';

  HideBlockAction copyWith({String? blockId}) =>
      HideBlockAction(blockId: blockId ?? this.blockId);

  factory HideBlockAction.fromJson(Map<String, dynamic> json) =>
      HideBlockAction(blockId: json['blockId'] as String);

  @override
  Map<String, dynamic> toJson() => {'type': type, 'blockId': blockId};
}
