import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:form_factor/form_factor.dart';
import 'package:formia_data/formia_data.dart';

import 'byok_key_provider.dart';
import 'form_document_controller.dart';

/// Only these models had free-tier quota during the Phase 0 spike (see
/// `docs/flutter_migration/08-task-briefs.md`) — `gemini-2.0-flash*` returned
/// quota 0 for the test key.
const _defaultModel = 'gemini-2.5-flash';

enum ChatRole { user, assistant }

class ChatEntry {
  const ChatEntry({required this.role, required this.content});
  final ChatRole role;
  final String content;
}

/// One tool call this turn, for the inline activity cards (07 §0/§8).
class ToolActivity {
  const ToolActivity({required this.name, required this.args, this.result, this.error});
  final String name;
  final Map<String, dynamic> args;
  final Object? result;
  final String? error;

  bool get isPending => result == null && error == null;

  ToolActivity copyWith({Object? result, String? error}) => ToolActivity(
        name: name,
        args: args,
        result: result ?? this.result,
        error: error ?? this.error,
      );
}

class AgentState {
  const AgentState({
    this.messages = const [],
    this.streamingText = '',
    this.toolActivity = const [],
    this.turnInProgress = false,
    this.pendingTurn,
    this.pendingStepSummaries = const [],
    this.error,
  });

  final List<ChatEntry> messages;
  final String streamingText;
  final List<ToolActivity> toolActivity;
  final bool turnInProgress;

  /// Set once a turn with edits finishes — awaiting user accept/reject
  /// (Propose mode, 07 §5.2). Canvas editing stays locked until resolved.
  final AiTurnCommand? pendingTurn;
  final List<String> pendingStepSummaries;
  final String? error;

  bool get isLocked => turnInProgress || pendingTurn != null;

  AgentState copyWith({
    List<ChatEntry>? messages,
    String? streamingText,
    List<ToolActivity>? toolActivity,
    bool? turnInProgress,
    AiTurnCommand? pendingTurn,
    bool clearPendingTurn = false,
    List<String>? pendingStepSummaries,
    String? error,
    bool clearError = false,
  }) =>
      AgentState(
        messages: messages ?? this.messages,
        streamingText: streamingText ?? this.streamingText,
        toolActivity: toolActivity ?? this.toolActivity,
        turnInProgress: turnInProgress ?? this.turnInProgress,
        pendingTurn: clearPendingTurn ? null : (pendingTurn ?? this.pendingTurn),
        pendingStepSummaries: pendingStepSummaries ?? this.pendingStepSummaries,
        error: clearError ? null : (error ?? this.error),
      );
}

String _describeStep(FormCommand cmd) => switch (cmd) {
      AddPageCommand(:final page) => '페이지 추가: ${page.title}',
      RemovePageCommand(:final pageId) => '페이지 삭제: $pageId',
      ReorderPageCommand(:final pageId) => '페이지 순서 변경: $pageId',
      AddBlockCommand() => '블록 추가',
      RemoveBlockCommand(:final blockId) => '블록 삭제: $blockId',
      UpdateBlockContentCommand(:final blockId) => '블록 수정: $blockId',
      MoveBlockCommand(:final blockId) => '블록 이동: $blockId',
      UpdateThemeCommand() => '테마 변경',
      UpdateMetadataCommand(:final title) => '제목 변경: ${title ?? ''}',
      AiTurnCommand() => 'AI 턴',
    };

/// One conversational turn with the agent (07): builds an `AgentTurn` whose
/// tools mutate a local draft doc (not the real one), then — Propose mode —
/// collapses the accumulated steps into one [AiTurnCommand] for the user to
/// accept/reject (02 §3, 07 §5.1/§5.2). The canvas stays locked
/// (`AgentState.isLocked`) the whole time.
class AgentController extends FamilyNotifier<AgentState, String> {
  @override
  AgentState build(String formId) => const AgentState();

  Future<void> sendMessage(String text) async {
    if (state.isLocked || text.trim().isEmpty) return;

    final apiKey = ref.read(byokKeyProvider);
    if (apiKey == null || apiKey.isEmpty) {
      state = state.copyWith(error: 'AI 키가 설정되지 않았습니다. 키를 먼저 등록하세요.');
      return;
    }
    final committedDoc = ref.read(formDocumentControllerProvider(arg)).doc;
    if (committedDoc == null) return;

    state = state.copyWith(
      messages: [...state.messages, ChatEntry(role: ChatRole.user, content: text)],
      turnInProgress: true,
      streamingText: '',
      toolActivity: const [],
      clearError: true,
    );

    var draftDoc = committedDoc;
    final steps = <FormCommand>[];

    final tools = [
      for (final spec in formEditingToolSpecs)
        AgentTool(
          name: spec.name,
          description: spec.description,
          inputSchema: spec.inputSchema,
          onCall: (args) async {
            if (spec.name == 'get_form_summary') {
              return summarizeForm(draftDoc);
            }
            final cmd = buildCommandFromTool(
              spec.name,
              args,
              timestamp: DateTime.now().toIso8601String(),
            );
            draftDoc = cmd.apply(draftDoc); // may throw -> fed back to the model
            steps.add(cmd);
            return {'status': 'ok', 'summary': summarizeForm(draftDoc)};
          },
        ),
    ];

    final agent = ClientDartanticAgent(apiKey: apiKey, model: _defaultModel);
    final turn = AgentTurn(
      messages: [
        for (final m in state.messages)
          m.role == ChatRole.user ? ChatMessage.user(m.content) : ChatMessage.system(m.content),
      ],
      tools: tools,
      systemPrompt:
          '당신은 Formia 설문 빌더의 AI 어시스턴트입니다. 사용자와 대화하며 폼을 함께 만듭니다. '
          '요청이 모호하면 목적·대상·문항 수 등을 먼저 되물으세요. '
          '변경이 필요하면 제공된 도구를 호출하세요(직접 JSON을 출력하지 마세요). '
          '현재 폼 요약: ${summarizeForm(committedDoc)}',
    );

    await for (final event in agent.run(turn)) {
      switch (event) {
        case TextDelta(:final text):
          state = state.copyWith(streamingText: state.streamingText + text);
        case ToolCalled(:final name, :final args):
          state = state.copyWith(
            toolActivity: [...state.toolActivity, ToolActivity(name: name, args: args)],
          );
        case ToolResulted(:final name, :final result):
          state = state.copyWith(toolActivity: _resolveLast(state.toolActivity, name, result));
        case TurnCompleted(:final text):
          final assistantText = text.isEmpty && steps.isNotEmpty ? '변경을 준비했어요. 검토해 주세요.' : text;
          state = state.copyWith(
            messages: assistantText.isEmpty
                ? state.messages
                : [...state.messages, ChatEntry(role: ChatRole.assistant, content: assistantText)],
            turnInProgress: false,
            streamingText: '',
            pendingTurn: steps.isEmpty
                ? null
                : AiTurnCommand(
                    steps: steps,
                    meta: CommandMeta(
                      author: CommandAuthor.ai,
                      timestamp: DateTime.now().toIso8601String(),
                      code: 'ai.turn',
                    ),
                  ),
            pendingStepSummaries: [for (final s in steps) _describeStep(s)],
          );
        case AgentErrored(:final message):
          state = state.copyWith(turnInProgress: false, error: message);
      }
    }
  }

  List<ToolActivity> _resolveLast(List<ToolActivity> activity, String name, Object? result) {
    final updated = [...activity];
    for (var i = updated.length - 1; i >= 0; i--) {
      if (updated[i].name == name && updated[i].isPending) {
        updated[i] = updated[i].copyWith(result: result ?? 'null');
        break;
      }
    }
    return updated;
  }

  void acceptPendingTurn() {
    final pending = state.pendingTurn;
    if (pending == null) return;
    ref.read(formDocumentControllerProvider(arg).notifier).execute(pending);
    state = state.copyWith(clearPendingTurn: true, pendingStepSummaries: const []);
  }

  void rejectPendingTurn() {
    if (state.pendingTurn == null) return;
    state = state.copyWith(
      clearPendingTurn: true,
      pendingStepSummaries: const [],
      messages: [...state.messages, const ChatEntry(role: ChatRole.assistant, content: '변경 사항을 취소했습니다.')],
    );
  }
}

final agentControllerProvider = NotifierProvider.family<AgentController, AgentState, String>(
  AgentController.new,
);
