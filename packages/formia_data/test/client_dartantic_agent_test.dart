@TestOn('vm')
library;

import 'dart:io';

import 'package:formia_data/formia_data.dart';
import 'package:test/test.dart';

/// Integration test for the client AI path (guest / client-held key): a
/// ClientDartanticAgent talks to Gemini native directly, streaming a
/// multi-step tool loop. Skipped unless GEMINI_API_KEY is set.
void main() {
  final key = Platform.environment['GEMINI_API_KEY'] ?? '';

  test(
    'streams a tool call + final text via native Gemini',
    () async {
      var toolCalled = false;
      final agent = ClientDartanticAgent(
        apiKey: key,
        model: 'gemini-2.5-flash',
      );

      final tool = AgentTool(
        name: 'get_form_summary',
        description: 'Returns a summary of the form being built.',
        onCall: (args) async {
          toolCalled = true;
          return {'title': '샘플 설문', 'pages': 3, 'blocks': 5};
        },
      );

      final events = <AgentEvent>[];
      await for (final e in agent.run(AgentTurn(
        messages: [
          ChatMessage.user(
            '지금 만드는 폼을 요약해줘. 반드시 get_form_summary 도구를 호출해 '
            '실제 구조를 확인한 뒤 한국어로 한 문장으로 요약해.',
          ),
        ],
        tools: [tool],
      ))) {
        events.add(e);
      }

      expect(events.whereType<AgentErrored>(), isEmpty,
          reason: events.whereType<AgentErrored>().map((e) => e.message).join());
      expect(toolCalled, isTrue, reason: 'tool must be invoked');
      expect(events.whereType<ToolCalled>(), isNotEmpty);
      expect(events.whereType<ToolResulted>(), isNotEmpty);
      final done = events.whereType<TurnCompleted>().toList();
      expect(done, isNotEmpty);
      expect(done.last.text, isNotEmpty);
    },
    timeout: const Timeout(Duration(seconds: 90)),
    skip: key.isNotEmpty ? false : 'set GEMINI_API_KEY',
  );
}
