import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Design tokens ported from the legacy React app's
/// `src/styles/tokens.css` ("Araform-inspired"). Kept as Dart constants
/// (not raw CSS) so widgets consume them the Flutter-native way (ColorScheme
/// + component themes) rather than literal hex strings everywhere.
class FormiaColors {
  const FormiaColors._();

  static const primary = Color(0xFF3B82F6);
  static const primaryGradientEnd = Color(0xFF60A5FA);
  static const background = Color(0xFFF6F9FF);
  static const surface = Color(0xFFFFFFFF);
  static const textMain = Color(0xFF1E293B);
  static const textMuted = Color(0xFF64748B);
  static const border = Color(0xFFE2E8F0);
  static const ink = Color(0xFF1A1A1A); // legacy .createBtn primary action
  static const success = Color(0xFF059669);
  static const successBg = Color(0xFFECFDF5);
  static const danger = Color(0xFFE53E3E);
}

class FormiaRadii {
  const FormiaRadii._();

  static const sm = 4.0;
  static const md = 8.0;
  static const lg = 12.0;
  static const xl = 16.0;
}

/// Brand wordmark matching the legacy gradient-text logo
/// (`.logo { background: linear-gradient(...) }`).
class FormiaWordmark extends StatelessWidget {
  const FormiaWordmark({super.key, this.fontSize = 22});

  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      shaderCallback: (bounds) => const LinearGradient(
        colors: [FormiaColors.primary, FormiaColors.primaryGradientEnd],
      ).createShader(bounds),
      child: Text(
        'Formia',
        style: GoogleFonts.notoSansKr(
          fontSize: fontSize,
          fontWeight: FontWeight.w900,
          letterSpacing: -0.5,
          color: Colors.white,
        ),
      ),
    );
  }
}

ThemeData formiaTheme() {
  final textTheme = GoogleFonts.notoSansKrTextTheme().copyWith(
    headlineSmall: GoogleFonts.notoSansKr(
      fontSize: 24,
      fontWeight: FontWeight.w700,
      color: FormiaColors.textMain,
    ),
    titleMedium: GoogleFonts.notoSansKr(
      fontWeight: FontWeight.w600,
      color: FormiaColors.textMain,
    ),
    bodyMedium: GoogleFonts.notoSansKr(color: FormiaColors.textMain),
    bodySmall: GoogleFonts.notoSansKr(color: FormiaColors.textMuted),
  );

  final colorScheme = ColorScheme.fromSeed(
    seedColor: FormiaColors.primary,
    brightness: Brightness.light,
  ).copyWith(
    primary: FormiaColors.primary,
    surface: FormiaColors.surface,
    onSurface: FormiaColors.textMain,
    outline: FormiaColors.border,
    error: FormiaColors.danger,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: FormiaColors.background,
    textTheme: textTheme,
    visualDensity: VisualDensity.standard,
    dividerColor: FormiaColors.border,
    appBarTheme: AppBarTheme(
      backgroundColor: FormiaColors.surface,
      surfaceTintColor: Colors.transparent,
      foregroundColor: FormiaColors.textMain,
      elevation: 0,
      titleTextStyle: GoogleFonts.notoSansKr(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: FormiaColors.textMain,
      ),
    ),
    cardTheme: CardThemeData(
      color: FormiaColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(FormiaRadii.lg),
        side: const BorderSide(color: FormiaColors.border),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: FormiaColors.ink,
        foregroundColor: Colors.white,
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(FormiaRadii.md)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: FormiaColors.textMain,
        side: const BorderSide(color: FormiaColors.border),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(FormiaRadii.md)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: FormiaColors.textMuted,
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: FormiaColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(FormiaRadii.md),
        borderSide: const BorderSide(color: FormiaColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(FormiaRadii.md),
        borderSide: const BorderSide(color: FormiaColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(FormiaRadii.md),
        borderSide: const BorderSide(color: FormiaColors.primary, width: 1.5),
      ),
    ),
    listTileTheme: ListTileThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(FormiaRadii.md)),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: FormiaColors.ink,
      foregroundColor: Colors.white,
      extendedTextStyle: TextStyle(fontWeight: FontWeight.w600),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: const Color(0xFFF1F5F9),
      labelStyle: const TextStyle(color: FormiaColors.textMuted, fontWeight: FontWeight.w700, fontSize: 12),
      side: const BorderSide(color: FormiaColors.border),
      shape: const StadiumBorder(),
    ),
  );
}
