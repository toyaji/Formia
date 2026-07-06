/// Data-layer package: Port interfaces and their implementations for Formia.
///
/// Ports (FormRepository, ResponseRepository, AgentPort) plus Supabase-backed
/// implementations and the client-side dartantic agent. Depends only on
/// form_factor + formia_core (no UI). See docs/flutter_migration/02, 03, 07.
library;

export 'src/agent/client_dartantic_agent.dart';
export 'src/agent/tool_catalog.dart';
export 'src/exceptions.dart';
export 'src/ports/agent_port.dart';
export 'src/ports/deployment_repository.dart';
export 'src/ports/form_repository.dart';
export 'src/ports/public_form_repository.dart';
export 'src/ports/response_repository.dart';
export 'src/supabase/supabase_deployment_repository.dart';
export 'src/supabase/supabase_form_repository.dart';
export 'src/supabase/supabase_public_form_repository.dart';
export 'src/supabase/supabase_response_repository.dart';
