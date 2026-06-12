import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { SystemMessage, HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { makeModel } from "./models";
import type { LlmConfig } from "./catalog";

// LangGraph orchestration for the project-brainstorm chat. A minimal single-node
// graph runs each conversation turn through whichever provider/model the admin
// selected (via the model factory), so the chat path shares the model binding
// and stays easy to extend with more nodes later.

export type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

const ChatState = Annotation.Root({
  messages: Annotation<ChatTurn[]>(),
  cfg: Annotation<LlmConfig>(),
  reply: Annotation<string>({ reducer: (_p, n) => n, default: () => "" }),
});

function toLangChainMessages(turns: ChatTurn[]): BaseMessage[] {
  return turns.map((m) =>
    m.role === "system"
      ? new SystemMessage(m.content)
      : m.role === "assistant"
        ? new AIMessage(m.content)
        : new HumanMessage(m.content)
  );
}

async function respondNode(state: typeof ChatState.State) {
  const model = makeModel(state.cfg);
  const res = await model.invoke(toLangChainMessages(state.messages));
  const reply = typeof res.content === "string" ? res.content : String(res.content ?? "");
  return { reply };
}

const chatGraph = new StateGraph(ChatState)
  .addNode("respond", respondNode)
  .addEdge(START, "respond")
  .addEdge("respond", END)
  .compile();

export async function runChatGraph(messages: ChatTurn[], cfg: LlmConfig): Promise<string> {
  const final = await chatGraph.invoke({ messages, cfg });
  return (final.reply ?? "").trim();
}

// Streaming variant — yields incremental text chunks as the model produces them.
// Streams straight from the model binding (the single respond node has nothing
// to add) so the brainstorm UI can render the coach's reply and the one-page
// proposal as they land instead of waiting for the full response.
export async function* streamChat(
  messages: ChatTurn[],
  cfg: LlmConfig
): AsyncGenerator<string, void, unknown> {
  const model = makeModel(cfg);
  const stream = await model.stream(toLangChainMessages(messages));
  for await (const chunk of stream) {
    const text = typeof chunk.content === "string" ? chunk.content : String(chunk.content ?? "");
    if (text) yield text;
  }
}
