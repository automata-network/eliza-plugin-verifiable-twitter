import {
    type Action,
    type IAgentRuntime,
    type Memory,
    type State,
    composeContext,
    elizaLogger,
    ModelClass,
    generateObject,
    truncateToCompleteSentence,
} from "@elizaos/core";
import { Scraper } from "agent-twitter-client";
import { tweetTemplate } from "../templates";
import { isTweetContent, TweetSchema } from "../types";
import { VerifiableTwitterSubagentProvider } from "../providers/verifiableTwitterSubagentProvider";

export const DEFAULT_MAX_TWEET_LENGTH = 280;

async function composeTweet(
    runtime: IAgentRuntime,
    _message: Memory,
    state?: State
): Promise<string> {
    try {
        const context = composeContext({
            state,
            template: tweetTemplate,
        });

        const tweetContentObject = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: TweetSchema,
            stop: ["\n"],
        });

        if (!isTweetContent(tweetContentObject.object)) {
            elizaLogger.error(
                "Invalid tweet content:",
                tweetContentObject.object
            );
            return;
        }

        let trimmedContent = tweetContentObject.object.text.trim();

        // Truncate the content to the maximum tweet length specified in the environment settings.
        const maxTweetLength = runtime.getSetting("MAX_TWEET_LENGTH");
        if (maxTweetLength) {
            trimmedContent = truncateToCompleteSentence(
                trimmedContent,
                Number(maxTweetLength)
            );
        }

        return trimmedContent;
    } catch (error) {
        elizaLogger.error("Error composing tweet:", error);
        throw error;
    }
}

export const postAction: Action = {
    name: "POST_VERIFIABLE_TWEET",
    similes: ["POST_VERIFIABLE_TWEET"],
    description: "Post a tweet to Twitter",
    validate: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ) => {
        return !!runtime.getSetting("TWITTER_CONSUMER_KEY")
            && !!runtime.getSetting("TWITTER_CONSUMER_SECRET")
            && !!runtime.getSetting("TWITTER_ACCESS_TOKEN")
            && !!runtime.getSetting("TWITTER_ACCESS_TOKEN_SECRET");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?,
        callback?
    ): Promise<boolean> => {
        try {
            const client = new VerifiableTwitterSubagentProvider(
                runtime.getSetting("TWITTER_CONSUMER_KEY"),
                runtime.getSetting("TWITTER_CONSUMER_SECRET"),
                runtime.getSetting("TWITTER_ACCESS_TOKEN"),
                runtime.getSetting("TWITTER_ACCESS_TOKEN_SECRET")
            );
            // Generate tweet content using context
            const tweetContent = await composeTweet(runtime, message, state);

            if (!tweetContent) {
                elizaLogger.error("No content generated for tweet");
                return false;
            }

            elizaLogger.log(`Generated tweet content: ${tweetContent}`);

            // Check for dry run mode - explicitly check for string "true"
            if (
                process.env.TWITTER_DRY_RUN &&
                process.env.TWITTER_DRY_RUN.toLowerCase() === "true"
            ) {
                elizaLogger.info(
                    `Dry run: would have posted tweet: ${tweetContent}`
                );
                return true;
            }

            const attestationReport = await client.postTweet(tweetContent);
            elizaLogger.info(`attestation report: ${attestationReport}`);
            return true;
        } catch (error) {
            elizaLogger.error("Error in post action:", error);
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "You should tweet that" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll share this update with my followers right away!",
                    action: "POST_VERIFIABLE_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Post this tweet" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll post that as a tweet now.",
                    action: "POST_VERIFIABLE_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Share that on Twitter" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll share this message on Twitter.",
                    action: "POST_VERIFIABLE_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Post that on X" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll post this message on X right away.",
                    action: "POST_VERIFIABLE_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "You should put that on X dot com" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll put this message up on X.com now.",
                    action: "POST_VERIFIABLE_TWEET",
                },
            },
        ],
    ],
};
