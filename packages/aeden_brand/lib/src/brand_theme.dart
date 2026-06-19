import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'brand_palette.dart';

ThemeData buildAedenBrandTheme({
  Brightness brightness = Brightness.light,
}) {
  final isDark = brightness == Brightness.dark;
  final baseTextTheme = GoogleFonts.interTextTheme();
  final surface = isDark ? AedenPalette.espresso : AedenPalette.cream;
  final foreground = isDark ? const Color(0xFFF7F2E9) : AedenPalette.ink;
  final muted = isDark ? const Color(0xFFE1C5AA) : AedenPalette.grey;
  final line = isDark ? const Color(0xFF4A2A16) : AedenPalette.line;

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    scaffoldBackgroundColor: surface,
    colorScheme: ColorScheme(
      brightness: brightness,
      primary: AedenPalette.goldBright,
      onPrimary: Colors.white,
      secondary: AedenPalette.gold,
      onSecondary: Colors.white,
      error: AedenPalette.red,
      onError: Colors.white,
      surface: surface,
      onSurface: foreground,
    ),
    textTheme: baseTextTheme.copyWith(
      displayLarge: GoogleFonts.fraunces(
        textStyle: baseTextTheme.displayLarge,
        fontWeight: FontWeight.w600,
        color: foreground,
      ),
      displayMedium: GoogleFonts.fraunces(
        textStyle: baseTextTheme.displayMedium,
        fontWeight: FontWeight.w600,
        color: foreground,
      ),
      headlineLarge: GoogleFonts.fraunces(
        textStyle: baseTextTheme.headlineLarge,
        fontWeight: FontWeight.w600,
        color: foreground,
      ),
      headlineMedium: GoogleFonts.fraunces(
        textStyle: baseTextTheme.headlineMedium,
        fontWeight: FontWeight.w600,
        color: foreground,
      ),
      headlineSmall: GoogleFonts.fraunces(
        textStyle: baseTextTheme.headlineSmall,
        fontWeight: FontWeight.w600,
        color: foreground,
      ),
      titleLarge: GoogleFonts.fraunces(
        textStyle: baseTextTheme.titleLarge,
        fontWeight: FontWeight.w600,
        color: foreground,
      ),
      titleMedium: baseTextTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w700,
        color: foreground,
      ),
      bodyLarge: baseTextTheme.bodyLarge?.copyWith(
        color: muted,
        height: 1.5,
      ),
      bodyMedium: baseTextTheme.bodyMedium?.copyWith(
        color: muted,
        height: 1.5,
      ),
      labelLarge: baseTextTheme.labelLarge?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: 0.2,
        color: foreground,
      ),
    ),
    dividerTheme: DividerThemeData(
      color: line,
      space: 1,
      thickness: 1,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? const Color(0xFF362012) : Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: isDark ? AedenPalette.goldLight : AedenPalette.gold, width: 1.4),
      ),
      labelStyle: TextStyle(color: muted),
      hintStyle: TextStyle(color: muted.withValues(alpha: 0.72)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: isDark ? AedenPalette.goldBright : AedenPalette.gold,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: foreground,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        side: BorderSide(color: line),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: isDark ? AedenPalette.goldLight : AedenPalette.gold,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: isDark ? const Color(0xFF362012) : Colors.white,
      selectedColor: isDark ? AedenPalette.goldBright : AedenPalette.ink,
      disabledColor: surface,
      side: BorderSide(color: line),
      labelStyle: baseTextTheme.labelLarge?.copyWith(color: foreground) ?? const TextStyle(),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
  );
}
