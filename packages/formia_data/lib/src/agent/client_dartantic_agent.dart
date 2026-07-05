import 'dart:async';

import 'package:dartantic_ai/dartantic_ai.dart' as da;
import 'package:json_schema/json_schema.dart';

import '../ports/agent_port.dart';

/// [AgentPort] whose loop runs in the client via dartantic_ai, calling Gemini's
/// NATIVE endpoint with streaming multi-step tool calling (07 §2).
///
/// Key handling: this implementation talks to Gemini **directly** with the key
/// it is given, so it is used for the guest / client-held-key case (03 §1),
/// where the key is the user's own and never touches our servers.
///
/// > For logged-in users whose key lives in Supabase Vault (must stay
/// > server-side), routing dartantic through the `llm-proxy` is not possible:
/// > dartantic's Google client issues absolute request URLs, so a custom
/// > `baseUrl` is ignored. That case uses a **server-side AgentPort** loop
/// > instead (07 §7 fallback) — a separate implementation.
class ClientDartanticAgent implements AgentPort {
  ClientDartanticAgent({
    required String apiKey,
    required this.model,
    Map<String, String> headers = const {},
  }) : _provider = da.GoogleProvider(apiKey: apiKey, headers: headers);

  final da.GoogleProvider _provider;
  final String model;

  @override
  bool get isAvailable => true;

  @override
  Stream<AgentEvent> run(AgentTurn turn) {
    final controller = StreamController<AgentEvent>();

    Future<void> drive() async {
      try {
        final tools = [
          for (final t in turn.tools)
            da.Tool(
              name: t.name,
              description: t.description,
              inputSchema: JsonSchema.create(t.inputSchema),
              onCall: (args) async {
                final map = _asStringMap(args);
                controller.add(ToolCalled(t.name, map));
                final result = await t.onCall(map);
                controller.add(ToolResulted(t.name, result));
                return result ?? {};
              },
            ),
        ];

        final agent = da.Agent.forProvider(
          _provider,
          chatModelName: model,
          tools: tools,
        );

        final history = <da.ChatMessage>[
          if (turn.systemPrompt != null) da.ChatMessage.system(turn.systemPrompt!),
        ];
        final msgs = [...turn.messages];
        final last = msgs.isNotEmpty ? msgs.removeLast() : null;
        for (final m in msgs) {
          history.add(m.role == 'system'
              ? da.ChatMessage.system(m.content)
              : da.ChatMessage.user(m.content));
        }

        final buf = StringBuffer();
        await for (final res
            in agent.sendStream(last?.content ?? '', history: history)) {
          if (res.output.isNotEmpty) {
            buf.write(res.output);
            controller.add(TextDelta(res.output));
          }
        }
        controller.add(TurnCompleted(buf.toString()));
      } on Object catch (e) {
        controller.add(AgentErrored(e.toString()));
      } finally {
        await controller.close();
      }
    }

    unawaited(drive());
    return controller.stream;
  }

  static Map<String, dynamic> _asStringMap(Object? args) {
    if (args is Map) {
      return args.map((k, v) => MapEntry(k.toString(), v));
    }
    return const {};
  }
}
