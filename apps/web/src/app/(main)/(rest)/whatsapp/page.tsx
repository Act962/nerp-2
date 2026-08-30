import { ChatContainer } from "@/features/whatsapp-chat/components/chat-container";
import { requirePermission } from "@/lib/auth-utils";

/**
 * A tela de atendimento ocupa a altura toda: a conversa rola por dentro, não
 * a página. `h-[calc(100dvh-8rem)]` desconta o header e o breadcrumb do shell.
 */
export default async function Page() {
  await requirePermission("whatsapp");

  return (
    <div className="h-[calc(100dvh-8rem)] min-h-0">
      <ChatContainer />
    </div>
  );
}
