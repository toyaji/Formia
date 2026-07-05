/// The AI agent's tool catalog (07 §4): a pure mapping from tool name + JSON
/// args to a [FormCommand]. Tools ARE `form_factor` commands — there is no
/// separate AI schema, so there is nothing to keep in sync (07 §2).
///
/// This file only builds commands; it never applies them. The caller
/// (`apps/editor`'s `agentController`) owns the draft document, applies each
/// command to it as the turn progresses, and — in Propose mode — only
/// commits the accumulated steps as one [AiTurnCommand] once the user
/// accepts (02 §3, 07 §5.2).
library;

import 'package:form_factor/form_factor.dart';
import 'package:uuid/uuid.dart';

const _uuid = Uuid();

/// Thrown when a tool call's arguments don't match what the tool expects.
class ToolArgumentException implements Exception {
  const ToolArgumentException(this.toolName, this.message);
  final String toolName;
  final String message;

  @override
  String toString() => 'ToolArgumentException($toolName: $message)';
}

/// Declares a tool's name/description/JSON schema (for the model) — no
/// `onCall`. The app layer binds `onCall` to a closure over its own draft
/// document (this package has no notion of "the current form").
class ToolSpec {
  const ToolSpec({
    required this.name,
    required this.description,
    required this.inputSchema,
  });

  final String name;
  final String description;
  final Map<String, dynamic> inputSchema;
}

const _pageRoleEnum = ['question', 'ending'];
const _blockTypeEnum = [
  'text',
  'textarea',
  'choice',
  'rating',
  'date',
  'file',
  'info',
  'statement',
];

/// The full editing + observation tool catalog (07 §4). `get_form_summary` is
/// read-only and handled separately by the caller via [summarizeForm] — it
/// has no corresponding [FormCommand].
const List<ToolSpec> formEditingToolSpecs = [
  ToolSpec(
    name: 'add_page',
    description: '새 페이지를 추가한다. 종료 페이지 앞에 삽입된다.',
    inputSchema: {
      'type': 'object',
      'properties': {
        'role': {'type': 'string', 'enum': _pageRoleEnum},
        'title': {'type': 'string'},
      },
      'required': ['title'],
    },
  ),
  ToolSpec(
    name: 'remove_page',
    description: '페이지를 삭제한다(시작/종료 페이지는 삭제 불가).',
    inputSchema: {
      'type': 'object',
      'properties': {
        'pageId': {'type': 'string'},
      },
      'required': ['pageId'],
    },
  ),
  ToolSpec(
    name: 'reorder_page',
    description: '페이지 순서를 바꾼다.',
    inputSchema: {
      'type': 'object',
      'properties': {
        'pageId': {'type': 'string'},
        'toIndex': {'type': 'integer'},
      },
      'required': ['pageId', 'toIndex'],
    },
  ),
  ToolSpec(
    name: 'add_block',
    description: '페이지에 새 질문 블록을 추가한다.',
    inputSchema: {
      'type': 'object',
      'properties': {
        'pageId': {'type': 'string'},
        'type': {'type': 'string', 'enum': _blockTypeEnum},
        'content': {'type': 'object'},
      },
      'required': ['pageId', 'type', 'content'],
    },
  ),
  ToolSpec(
    name: 'update_block',
    description: '기존 블록의 내용을 수정한다(질문 타입은 유지).',
    inputSchema: {
      'type': 'object',
      'properties': {
        'blockId': {'type': 'string'},
        'content': {'type': 'object'},
      },
      'required': ['blockId', 'content'],
    },
  ),
  ToolSpec(
    name: 'remove_block',
    description: '블록을 삭제한다.',
    inputSchema: {
      'type': 'object',
      'properties': {
        'blockId': {'type': 'string'},
      },
      'required': ['blockId'],
    },
  ),
  ToolSpec(
    name: 'move_block',
    description: '블록을 다른 위치/페이지로 옮긴다.',
    inputSchema: {
      'type': 'object',
      'properties': {
        'blockId': {'type': 'string'},
        'toPageId': {'type': 'string'},
        'toIndex': {'type': 'integer'},
      },
      'required': ['blockId', 'toPageId', 'toIndex'],
    },
  ),
  ToolSpec(
    name: 'set_metadata',
    description: '폼 제목/설명을 수정한다.',
    inputSchema: {
      'type': 'object',
      'properties': {
        'title': {'type': 'string'},
        'description': {'type': 'string'},
      },
    },
  ),
  ToolSpec(
    name: 'get_form_summary',
    description: '현재 폼 구조(페이지/블록 요약)를 확인한다.',
    inputSchema: {'type': 'object', 'properties': {}},
  ),
];

/// Builds the [FormCommand] for one AI tool call. Throws
/// [ToolArgumentException] for malformed args and [UnsupportedError] for
/// `get_form_summary` (read-only — see [summarizeForm]).
FormCommand buildCommandFromTool(
  String toolName,
  Map<String, dynamic> args, {
  required String timestamp,
}) {
  final meta = CommandMeta(
    author: CommandAuthor.ai,
    timestamp: timestamp,
    code: 'ai.$toolName',
    params: args,
  );

  switch (toolName) {
    case 'add_page':
      final title = _requireString(toolName, args, 'title');
      final roleStr = args['role'] as String? ?? 'question';
      final role = roleStr == 'ending' ? PageRole.ending : PageRole.question;
      return AddPageCommand(
        page: FormPage(id: _uuid.v4(), role: role, title: title),
        meta: meta,
      );

    case 'remove_page':
      return RemovePageCommand(
        pageId: _requireString(toolName, args, 'pageId'),
        meta: meta,
      );

    case 'reorder_page':
      return ReorderPageCommand(
        pageId: _requireString(toolName, args, 'pageId'),
        toIndex: _requireInt(toolName, args, 'toIndex'),
        meta: meta,
      );

    case 'add_block':
      final pageId = _requireString(toolName, args, 'pageId');
      final type = _requireString(toolName, args, 'type');
      final content = _requireMap(toolName, args, 'content');
      return AddBlockCommand(
        pageId: pageId,
        block: FormBlock(id: _uuid.v4(), content: parseBlockContent(type, content)),
        meta: meta,
      );

    case 'update_block':
      final blockId = _requireString(toolName, args, 'blockId');
      final content = _requireMap(toolName, args, 'content');
      final type = content['type'] as String?;
      if (type == null) {
        throw const ToolArgumentException(
          'update_block',
          'content.type is required (must match the block\'s current type)',
        );
      }
      return UpdateBlockContentCommand(
        blockId: blockId,
        content: parseBlockContent(type, content),
        meta: meta,
      );

    case 'remove_block':
      return RemoveBlockCommand(
        blockId: _requireString(toolName, args, 'blockId'),
        meta: meta,
      );

    case 'move_block':
      return MoveBlockCommand(
        blockId: _requireString(toolName, args, 'blockId'),
        toPageId: _requireString(toolName, args, 'toPageId'),
        toIndex: _requireInt(toolName, args, 'toIndex'),
        meta: meta,
      );

    case 'set_metadata':
      return UpdateMetadataCommand(
        title: args['title'] as String?,
        description: args['description'] as String?,
        meta: meta,
      );

    case 'get_form_summary':
      throw UnsupportedError(
        'get_form_summary is read-only — call summarizeForm() instead of buildCommandFromTool()',
      );

    default:
      throw ToolArgumentException(toolName, 'unknown tool');
  }
}

/// Parses raw tool-call block content into a [BlockContent], reusing the
/// domain's own `fromJson` dispatch (no parallel AI schema, 07 §2).
BlockContent parseBlockContent(String type, Map<String, dynamic> content) {
  final withType = {...content, 'type': type};
  try {
    return BlockContent.fromJson(withType);
  } on Object catch (e) {
    throw ToolArgumentException('add_block/update_block', 'invalid content: $e');
  }
}

/// Read-only summary for the `get_form_summary` tool result (07 §4) — lets
/// the model re-observe the draft mid-turn (e.g. to learn a new page's id).
Map<String, dynamic> summarizeForm(FormFactor factor) => {
      'title': factor.metadata.title,
      'pages': [
        for (final page in factor.pages)
          {
            'id': page.id,
            'role': page.role.toJson(),
            'title': page.title,
            'locked': page.locked,
            'blocks': [
              for (final block in page.blocks)
                {'id': block.id, 'type': block.content.type},
            ],
          },
      ],
    };

String _requireString(String toolName, Map<String, dynamic> args, String key) {
  final value = args[key];
  if (value is! String || value.isEmpty) {
    throw ToolArgumentException(toolName, '"$key" is required and must be a non-empty string');
  }
  return value;
}

int _requireInt(String toolName, Map<String, dynamic> args, String key) {
  final value = args[key];
  if (value is int) return value;
  if (value is num) return value.toInt();
  throw ToolArgumentException(toolName, '"$key" is required and must be an integer');
}

Map<String, dynamic> _requireMap(String toolName, Map<String, dynamic> args, String key) {
  final value = args[key];
  if (value is! Map) {
    throw ToolArgumentException(toolName, '"$key" is required and must be an object');
  }
  return value.map((k, v) => MapEntry(k.toString(), v));
}
