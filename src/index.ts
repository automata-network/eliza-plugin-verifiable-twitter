import type { Plugin } from "@elizaos/core";
import { postAction } from "./actions/post";

export const verifiableTwitterPlugin: Plugin = {
    name: "verifiable-twitter",
    description: "Automata 1RPC Verifiable Twitter Subagent",
    actions: [postAction],
    evaluators: [],
    providers: [],
};

export default verifiableTwitterPlugin;
