/// Reports structural/logic issues that construction-time invariants do not
/// cover: dangling logic references, graph reachability/termination, and jump
/// direction rules (see `docs/flutter_migration/01-form-factor-v3.md#3.1`, `#6`).
library;

import '../model/enums.dart';
import '../model/form_factor.dart';
import '../model/logic.dart';
import '../model/page.dart';
import 'validation_error.dart';

class FormFactorValidator {
  const FormFactorValidator();

  List<ValidationError> validate(FormFactor factor) {
    final errors = <ValidationError>[];
    final pages = factor.pages;

    // Index maps.
    final pageIndexById = <String, int>{};
    for (var i = 0; i < pages.length; i++) {
      pageIndexById[pages[i].id] = i;
    }
    final blockPageIndexById = <String, int>{};
    for (var i = 0; i < pages.length; i++) {
      for (final b in pages[i].blocks) {
        blockPageIndexById[b.id] = i;
      }
    }

    // 1) Dangling references + jump direction.
    for (final rule in factor.logic.rules) {
      for (final blockId in _conditionBlockIds(rule.when)) {
        if (!blockPageIndexById.containsKey(blockId)) {
          errors.add(ValidationError('logic.danglingBlock',
              params: {'ruleId': rule.id, 'blockId': blockId}));
        }
      }
      // Context index = latest page whose answer can trigger this rule.
      final ctxIndices = _conditionBlockIds(rule.when)
          .map((id) => blockPageIndexById[id])
          .whereType<int>()
          .toList();
      final ctxIndex = ctxIndices.isEmpty ? 0 : ctxIndices.reduce(_max);

      for (final action in rule.then) {
        switch (action) {
          case JumpToPageAction(:final pageId):
            final target = pageIndexById[pageId];
            if (target == null) {
              errors.add(ValidationError('logic.danglingPage',
                  params: {'ruleId': rule.id, 'pageId': pageId}));
            } else if (target <= ctxIndex &&
                pages[target].role != PageRole.ending) {
              // Backward/self jump to a non-ending page → loop risk (§3.1).
              errors.add(ValidationError('logic.backwardJump',
                  severity: ValidationSeverity.warning,
                  params: {'ruleId': rule.id, 'pageId': pageId}));
            }
          case ShowBlockAction(:final blockId):
          case HideBlockAction(:final blockId):
            if (!blockPageIndexById.containsKey(blockId)) {
              errors.add(ValidationError('logic.danglingBlock',
                  params: {'ruleId': rule.id, 'blockId': blockId}));
            }
        }
      }
    }

    // 2) Reachability via natural flow + jump edges (fixpoint).
    final reachable = _reachablePages(factor, blockPageIndexById, pageIndexById);
    for (var i = 0; i < pages.length; i++) {
      if (!reachable.contains(i)) {
        errors.add(ValidationError('pages.unreachable',
            severity: ValidationSeverity.warning, params: {'pageId': pages[i].id}));
      }
    }

    // 3) Termination: every reachable page must be able to reach an ending.
    final edges = _navEdges(factor, blockPageIndexById, pageIndexById);
    for (final i in reachable) {
      if (!_canReachEnding(i, pages, edges)) {
        errors.add(ValidationError('pages.deadEnd', params: {'pageId': pages[i].id}));
      }
    }

    return errors;
  }

  // ── helpers ──────────────────────────────────────────────────────────

  static int _max(int a, int b) => a > b ? a : b;

  Set<String> _conditionBlockIds(LogicCondition c) {
    switch (c) {
      case BlockAnswerCondition(:final blockId):
        return {blockId};
      case AndCondition(:final all):
        return all.expand(_conditionBlockIds).toSet();
      case OrCondition(:final any):
        return any.expand(_conditionBlockIds).toSet();
    }
  }

  /// Directed navigation edges: non-ending page i → i+1 (natural flow), plus
  /// jump edges from a rule's context page to each JumpToPage target.
  Map<int, Set<int>> _navEdges(
    FormFactor factor,
    Map<String, int> blockPageIndexById,
    Map<String, int> pageIndexById,
  ) {
    final pages = factor.pages;
    final edges = <int, Set<int>>{};
    for (var i = 0; i < pages.length; i++) {
      edges[i] = <int>{};
      if (pages[i].role != PageRole.ending && i + 1 < pages.length) {
        edges[i]!.add(i + 1);
      }
    }
    for (final rule in factor.logic.rules) {
      final ctxIndices = _conditionBlockIds(rule.when)
          .map((id) => blockPageIndexById[id])
          .whereType<int>()
          .toList();
      final ctxIndex = ctxIndices.isEmpty ? 0 : ctxIndices.reduce(_max);
      for (final action in rule.then) {
        if (action is JumpToPageAction) {
          final target = pageIndexById[action.pageId];
          if (target != null) edges[ctxIndex]!.add(target);
        }
      }
    }
    return edges;
  }

  Set<int> _reachablePages(
    FormFactor factor,
    Map<String, int> blockPageIndexById,
    Map<String, int> pageIndexById,
  ) {
    final edges = _navEdges(factor, blockPageIndexById, pageIndexById);
    final reachable = <int>{0};
    final queue = <int>[0];
    while (queue.isNotEmpty) {
      final cur = queue.removeLast();
      for (final next in edges[cur] ?? const <int>{}) {
        if (reachable.add(next)) queue.add(next);
      }
    }
    return reachable;
  }

  bool _canReachEnding(int from, List<FormPage> pages, Map<int, Set<int>> edges) {
    final seen = <int>{from};
    final queue = <int>[from];
    while (queue.isNotEmpty) {
      final cur = queue.removeLast();
      if (pages[cur].role == PageRole.ending) return true;
      for (final next in edges[cur] ?? const <int>{}) {
        if (seen.add(next)) queue.add(next);
      }
    }
    return false;
  }
}
