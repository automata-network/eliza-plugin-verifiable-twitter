// src/actions/post.ts
import {
  composeContext,
  elizaLogger as elizaLogger2,
  ModelClass,
  generateObject,
  truncateToCompleteSentence
} from "@elizaos/core";

// src/templates.ts
var tweetTemplate = `
# Context
{{recentMessages}}

# Topics
{{topics}}

# Post Directions
{{postDirections}}

# Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

# Task
Generate a tweet that:
1. Relates to the recent conversation or requested topic
2. Matches the character's style and voice
3. Is concise and engaging
4. Must be UNDER 180 characters (this is a strict requirement)
5. Speaks from the perspective of {{agentName}}

Generate only the tweet text, no other commentary.

Return the tweet in JSON format like: {"text": "your tweet here"}`;

// src/types.ts
import { z } from "zod";
var TweetSchema = z.object({
  text: z.string().describe("The text of the tweet")
});
var isTweetContent = (obj) => {
  return TweetSchema.safeParse(obj).success;
};

// src/providers/verifiableTwitterSubagentProvider.ts
import { elizaLogger } from "@elizaos/core";
import http from "http";
import https from "https";
import net from "net";
var VerifiableTwitterSubagentProvider = class {
  constructor(consumerKey, consumerSecret, accessToken, accessTokenSecret, subagentUrl) {
    if (!subagentUrl) {
      subagentUrl = "https://subagent.1rpc.io";
    }
    this.subagentUrl = subagentUrl;
    this.accessToken = accessToken;
    this.accessTokenSecret = accessTokenSecret;
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
  }
  async postTweet(tweetContent) {
    const params = {
      consumer_key: this.consumerKey,
      consumer_secret: this.consumerSecret,
      access_token: this.accessToken,
      access_token_secret: this.accessTokenSecret,
      text: tweetContent
    };
    const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tweet", params: [params] });
    elizaLogger.info("[VerifiableTwitterSubagent] send tweet:", tweetContent);
    const response = await send_rpc_request(this.subagentUrl, "/", payload);
    if (response.error) {
      throw new Error(`[VerifiableTwitterSubagent] error: ${response.error.message}`);
    }
    return response.result;
  }
};
function send_rpc_request(endpoint, path, payload) {
  return new Promise((resolve, reject) => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
      reject(new Error("Request timed out"));
    }, 3e4);
    const isHttp = endpoint.startsWith("http://") || endpoint.startsWith("https://");
    if (isHttp) {
      const url = new URL(path, endpoint);
      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      };
      const req = (url.protocol === "https:" ? https : http).request(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          clearTimeout(timeout);
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (error) {
            reject(new Error("Failed to parse response"));
          }
        });
      });
      req.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      abortController.signal.addEventListener("abort", () => {
        req.destroy();
        reject(new Error("Request aborted"));
      });
      req.write(payload);
      req.end();
    } else {
      const client = net.createConnection({ path: endpoint }, () => {
        client.write(`POST ${path} HTTP/1.1\r
`);
        client.write(`Host: localhost\r
`);
        client.write(`Content-Type: application/json\r
`);
        client.write(`Content-Length: ${payload.length}\r
`);
        client.write("\r\n");
        client.write(payload);
      });
      let data = "";
      let headers = {};
      let headersParsed = false;
      let contentLength = 0;
      let bodyData = "";
      client.on("data", (chunk) => {
        data += chunk;
        if (!headersParsed) {
          const headerEndIndex = data.indexOf("\r\n\r\n");
          if (headerEndIndex !== -1) {
            const headerLines = data.slice(0, headerEndIndex).split("\r\n");
            headerLines.forEach((line) => {
              const [key, value] = line.split(": ");
              if (key && value) {
                headers[key.toLowerCase()] = value;
              }
            });
            headersParsed = true;
            contentLength = parseInt(headers["content-length"] || "0", 10);
            bodyData = data.slice(headerEndIndex + 4);
          }
        } else {
          bodyData += chunk;
        }
        if (headersParsed && bodyData.length >= contentLength) {
          client.end();
        }
      });
      client.on("end", () => {
        clearTimeout(timeout);
        try {
          const result = JSON.parse(bodyData.slice(0, contentLength));
          resolve(result);
        } catch (error) {
          reject(new Error("Failed to parse response"));
        }
      });
      client.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      abortController.signal.addEventListener("abort", () => {
        client.destroy();
        reject(new Error("Request aborted"));
      });
    }
  });
}

// src/actions/post.ts
async function composeTweet(runtime, _message, state) {
  try {
    const context = composeContext({
      state,
      template: tweetTemplate
    });
    const tweetContentObject = await generateObject({
      runtime,
      context,
      modelClass: ModelClass.SMALL,
      schema: TweetSchema,
      stop: ["\n"]
    });
    if (!isTweetContent(tweetContentObject.object)) {
      elizaLogger2.error(
        "Invalid tweet content:",
        tweetContentObject.object
      );
      return;
    }
    let trimmedContent = tweetContentObject.object.text.trim();
    const maxTweetLength = runtime.getSetting("MAX_TWEET_LENGTH");
    if (maxTweetLength) {
      trimmedContent = truncateToCompleteSentence(
        trimmedContent,
        Number(maxTweetLength)
      );
    }
    return trimmedContent;
  } catch (error) {
    elizaLogger2.error("Error composing tweet:", error);
    throw error;
  }
}
var postAction = {
  name: "POST_VERIFIABLE_TWEET",
  similes: ["POST_VERIFIABLE_TWEET"],
  description: "Post a tweet to Twitter",
  validate: async (runtime, _message, _state) => {
    return !!runtime.getSetting("TWITTER_CONSUMER_KEY") && !!runtime.getSetting("TWITTER_CONSUMER_SECRET") && !!runtime.getSetting("TWITTER_ACCESS_TOKEN") && !!runtime.getSetting("TWITTER_ACCESS_TOKEN_SECRET");
  },
  handler: async (runtime, message, state, options, callback) => {
    try {
      const client = new VerifiableTwitterSubagentProvider(
        runtime.getSetting("TWITTER_CONSUMER_KEY"),
        runtime.getSetting("TWITTER_CONSUMER_SECRET"),
        runtime.getSetting("TWITTER_ACCESS_TOKEN"),
        runtime.getSetting("TWITTER_ACCESS_TOKEN_SECRET")
      );
      const tweetContent = await composeTweet(runtime, message, state);
      if (!tweetContent) {
        elizaLogger2.error("No content generated for tweet");
        return false;
      }
      elizaLogger2.log(`Generated tweet content: ${tweetContent}`);
      if (process.env.TWITTER_DRY_RUN && process.env.TWITTER_DRY_RUN.toLowerCase() === "true") {
        elizaLogger2.info(
          `Dry run: would have posted tweet: ${tweetContent}`
        );
        return true;
      }
      const attestationReport = await client.postTweet(tweetContent);
      elizaLogger2.info(`attestation report: ${attestationReport}`);
      return true;
    } catch (error) {
      elizaLogger2.error(`Error in post action: ${error}`);
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "You should tweet that" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "I'll share this update with my followers right away!",
          action: "POST_VERIFIABLE_TWEET"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Post this tweet" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "I'll post that as a tweet now.",
          action: "POST_VERIFIABLE_TWEET"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Share that on Twitter" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "I'll share this message on Twitter.",
          action: "POST_VERIFIABLE_TWEET"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Post that on X" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "I'll post this message on X right away.",
          action: "POST_VERIFIABLE_TWEET"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "You should put that on X dot com" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "I'll put this message up on X.com now.",
          action: "POST_VERIFIABLE_TWEET"
        }
      }
    ]
  ]
};

// src/index.ts
var verifiableTwitterPlugin = {
  name: "verifiable-twitter",
  description: "Automata 1RPC Verifiable Twitter Subagent",
  actions: [postAction],
  evaluators: [],
  providers: []
};
var index_default = verifiableTwitterPlugin;
export {
  index_default as default,
  verifiableTwitterPlugin
};
//# sourceMappingURL=index.js.map