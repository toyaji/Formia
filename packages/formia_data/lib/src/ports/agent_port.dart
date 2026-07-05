import 'dart:async';

/// A single message in the agent conversation.
class ChatMessage {
  const ChatMessage({required this.role, required this.content});
  final String role; // 'user' | 'assistant' | 'system'
  final String content;

  factory ChatMessage.user(String c) => ChatMessage(role: 'user', content: c);
  factory ChatMessage.system(String c) =>
      ChatMessage(role: 'system', content: c);
}

/// A tool the agent may call. The [onCall] handler runs in the client and
/// (for editor tools) maps to a FormCommand over the shared form_factor model
/// (07 §4). Returns a JSON-serializable result fed back to the model.
class AgentTool {
  const AgentTool({
    required this.name,
    required this.description,
    this.inputSchema = const {'type': 'object', 'properties': {}},
    required this.onCall,
  });

  final String name;
  final String description;
  final Map<String, dynamic> inputSchema;
  final FutureOr<Object?> Function(Map<String, dynamic> args) onCall;
}

/// One turn: conversation so far + available tools + optional system prompt.
class AgentTurn {
  const AgentTurn({
    required this.messages,
    this.tools = const [],
    this.systemPrompt,
  });

  final List<ChatMessage> messages;
  final List<AgentTool> tools;
  final String? systemPrompt;
}

/// Streaming events emitted during a turn. UI consumes this stream so the loop
/// can live in the client or (later) on a server without UI changes (07 §3).
sealed class AgentEvent {
  const AgentEvent();
}

class TextDelta extends AgentEvent {
  const TextDelta(this.text);
  final String text;
}

class ToolCalled extends AgentEvent {
  const ToolCalled(this.name, this.args);
  final String name;
  final Map<String, dynamic> args;
}

class ToolResulted extends AgentEvent {
  const ToolResulted(this.name, this.result);
  final String name;
  final Object? result;
}

class TurnCompleted extends AgentEvent {
  const TurnCompleted(this.text);
  final String text;
}

class AgentErrored extends AgentEvent {
  const AgentErrored(this.message);
  final String message;
}

/// The conversational AI agent (07). The loop lives behind this port so it can
/// be swapped (client dartantic / server loop) without touching the UI.
abstract interface class AgentPort {
  Stream<AgentEvent> run(AgentTurn turn);
  bool get isAvailable;
}
