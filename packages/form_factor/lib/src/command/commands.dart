/// Typed edit commands. Every mutation to a [FormFactor] — by a human or the
/// AI agent — is a [FormCommand]. `apply` returns a NEW validated document
/// (immutable); it never mutates in place, which makes atomic AI turns and
/// undo trivial (see `docs/flutter_migration/02-app-architecture.md#3`).
library;

import 'package:meta/meta.dart';

import '../model/block.dart';
import '../model/block_content.dart';
import '../model/form_factor.dart';
import '../model/exceptions.dart';
import '../model/page.dart';
import '../model/theme.dart';

enum CommandAuthor { human, ai }

@immutable
class CommandMeta {
  const CommandMeta({
    required this.author,
    required this.timestamp,
    required this.code,
    this.params = const {},
  });

  final CommandAuthor author;
  final String timestamp; // ISO-8601
  final String code; // i18n key describing the change
  final Map<String, Object?> params;
}

@immutable
sealed class FormCommand {
  const FormCommand({required this.meta});

  final CommandMeta meta;

  /// Returns a new, validated document with this command applied.
  /// Throws [FormFactorViolation] if the result would be invalid.
  FormFactor apply(FormFactor doc);
}

/// Applies a list of commands as ONE atomic unit. If any step throws, nothing
/// is committed (apply builds a new doc and only returns it if every step
/// succeeds), and a single undo reverts the whole turn (07 §5.1).
final class AiTurnCommand extends FormCommand {
  const AiTurnCommand({required this.steps, required super.meta});

  final List<FormCommand> steps;

  @override
  FormFactor apply(FormFactor doc) {
    var d = doc;
    for (final step in steps) {
      d = step.apply(d); // throw here => original `doc` never replaced
    }
    return d;
  }
}

final class AddBlockCommand extends FormCommand {
  const AddBlockCommand({
    required this.pageId,
    required this.block,
    this.index,
    required super.meta,
  });

  final String pageId;
  final FormBlock block;
  final int? index;

  @override
  FormFactor apply(FormFactor doc) {
    final pages = doc.pages.map((p) {
      if (p.id != pageId) return p;
      final blocks = [...p.blocks];
      final i = index ?? blocks.length;
      blocks.insert(i.clamp(0, blocks.length), block);
      return p.copyWith(blocks: blocks);
    }).toList();
    if (!doc.pages.any((p) => p.id == pageId)) {
      throw FormFactorViolation('page.notFound', {'pageId': pageId});
    }
    return doc.copyWith(pages: pages);
  }
}

final class RemoveBlockCommand extends FormCommand {
  const RemoveBlockCommand({required this.blockId, required super.meta});

  final String blockId;

  @override
  FormFactor apply(FormFactor doc) {
    FormBlock? found;
    for (final p in doc.pages) {
      for (final b in p.blocks) {
        if (b.id == blockId) found = b;
      }
    }
    if (found == null) {
      throw FormFactorViolation('block.notFound', {'blockId': blockId});
    }
    if (!found.removable) {
      throw FormFactorViolation('block.notRemovable', {'blockId': blockId});
    }
    final pages = doc.pages
        .map((p) =>
            p.copyWith(blocks: p.blocks.where((b) => b.id != blockId).toList()))
        .toList();
    return doc.copyWith(pages: pages);
  }
}

final class UpdateBlockContentCommand extends FormCommand {
  const UpdateBlockContentCommand({
    required this.blockId,
    required this.content,
    required super.meta,
  });

  final String blockId;
  final BlockContent content;

  @override
  FormFactor apply(FormFactor doc) {
    var found = false;
    final pages = doc.pages.map((p) {
      return p.copyWith(
        blocks: p.blocks.map((b) {
          if (b.id != blockId) return b;
          found = true;
          return b.copyWith(content: content);
        }).toList(),
      );
    }).toList();
    if (!found) {
      throw FormFactorViolation('block.notFound', {'blockId': blockId});
    }
    return doc.copyWith(pages: pages);
  }
}

final class MoveBlockCommand extends FormCommand {
  const MoveBlockCommand({
    required this.blockId,
    required this.toPageId,
    required this.toIndex,
    required super.meta,
  });

  final String blockId;
  final String toPageId;
  final int toIndex;

  @override
  FormFactor apply(FormFactor doc) {
    FormBlock? moving;
    // Remove from wherever it is.
    var pages = doc.pages.map((p) {
      final keep = <FormBlock>[];
      for (final b in p.blocks) {
        if (b.id == blockId) {
          moving = b;
        } else {
          keep.add(b);
        }
      }
      return p.copyWith(blocks: keep);
    }).toList();
    final block = moving;
    if (block == null) {
      throw FormFactorViolation('block.notFound', {'blockId': blockId});
    }
    if (!doc.pages.any((p) => p.id == toPageId)) {
      throw FormFactorViolation('page.notFound', {'pageId': toPageId});
    }
    pages = pages.map((p) {
      if (p.id != toPageId) return p;
      final blocks = [...p.blocks];
      blocks.insert(toIndex.clamp(0, blocks.length), block);
      return p.copyWith(blocks: blocks);
    }).toList();
    return doc.copyWith(pages: pages);
  }
}

final class ReorderPageCommand extends FormCommand {
  const ReorderPageCommand({
    required this.pageId,
    required this.toIndex,
    required super.meta,
  });

  final String pageId;
  final int toIndex;

  @override
  FormFactor apply(FormFactor doc) {
    final pages = [...doc.pages];
    final from = pages.indexWhere((p) => p.id == pageId);
    if (from < 0) {
      throw FormFactorViolation('page.notFound', {'pageId': pageId});
    }
    if (pages[from].locked) {
      throw FormFactorViolation('page.locked', {'pageId': pageId});
    }
    final page = pages.removeAt(from);
    pages.insert(toIndex.clamp(0, pages.length), page);
    // FormFactor constructor re-checks invariants (start first / ending last).
    return doc.copyWith(pages: pages);
  }
}

final class AddPageCommand extends FormCommand {
  const AddPageCommand({
    required this.page,
    this.index,
    required super.meta,
  });

  final FormPage page;

  /// Insertion index; defaults to just before the trailing ending page(s)
  /// (i.e. `pages.length - 1`), since appending after the last page would
  /// violate the "last page is an ending" invariant.
  final int? index;

  @override
  FormFactor apply(FormFactor doc) {
    final pages = [...doc.pages];
    final at = (index ?? pages.length - 1).clamp(0, pages.length);
    pages.insert(at, page);
    // FormFactor constructor re-checks invariants (unique ids, role ordering).
    return doc.copyWith(pages: pages);
  }
}

final class RemovePageCommand extends FormCommand {
  const RemovePageCommand({required this.pageId, required super.meta});

  final String pageId;

  @override
  FormFactor apply(FormFactor doc) {
    final index = doc.pages.indexWhere((p) => p.id == pageId);
    if (index < 0) {
      throw FormFactorViolation('page.notFound', {'pageId': pageId});
    }
    if (doc.pages[index].locked) {
      throw FormFactorViolation('page.locked', {'pageId': pageId});
    }
    final pages = [...doc.pages]..removeAt(index);
    // FormFactor constructor re-checks invariants (e.g. at least one ending).
    return doc.copyWith(pages: pages);
  }
}

final class UpdateThemeCommand extends FormCommand {
  const UpdateThemeCommand({required this.theme, required super.meta});

  final FormTheme theme;

  @override
  FormFactor apply(FormFactor doc) => doc.copyWith(theme: theme);
}

final class UpdateMetadataCommand extends FormCommand {
  const UpdateMetadataCommand({this.title, this.description, required super.meta});

  final String? title;
  final String? description;

  @override
  FormFactor apply(FormFactor doc) => doc.copyWith(
        metadata: doc.metadata.copyWith(
          title: title,
          description: description,
        ),
      );
}
