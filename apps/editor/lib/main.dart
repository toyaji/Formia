import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';

/// Local-dev defaults for `supabase start` (see `supabase/config.toml`).
/// Override with `--dart-define=SUPABASE_URL=...` / `SUPABASE_ANON_KEY=...`
/// for staging/prod builds.
const _localSupabaseUrl = 'http://127.0.0.1:54321';
const _localSupabaseAnonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabaseUrl = String.fromEnvironment(
  'SUPABASE_URL',
  defaultValue: _localSupabaseUrl,
);
const supabaseAnonKey = String.fromEnvironment(
  'SUPABASE_ANON_KEY',
  defaultValue: _localSupabaseAnonKey,
);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();
  await Supabase.initialize(url: supabaseUrl, publishableKey: supabaseAnonKey);
  runApp(const ProviderScope(child: FormiaEditorApp()));
}
