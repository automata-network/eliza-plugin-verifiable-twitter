<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/automata-network/automata-brand-kit/main/PNG/ATA_White%20Text%20with%20Color%20Logo.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/automata-network/automata-brand-kit/main/PNG/ATA_Black%20Text%20with%20Color%20Logo.png">
    <img src="https://raw.githubusercontent.com/automata-network/automata-brand-kit/main/PNG/ATA_White%20Text%20with%20Color%20Logo.png" width="50%">
  </picture>
</div>

# @elizaos/plugin-verifiable-twitter

## Overview

`@elizaos/plugin-verifiable-twitter` is a plugin designed for the ElizaOS platform, providing integration with verifiable Twitter/X subagent. The 

## Features

- Integration with Twitter API
- Supports verifiable actions on Twitter

## Usage

To use the plugin, you need to configure the following environment variables with your Twitter API credentials:

- `TWITTER_CONSUMER_KEY`: Twitter API Key
- `TWITTER_CONSUMER_SECRET`: Twitter API Key Secret
- `TWITTER_ACCESS_TOKEN`: Twitter API Access Token
- `TWITTER_ACCESS_TOKEN_SECRET`: Twitter API Access Token Secret

These credentials can be obtained from the [X Developer Portal](https://developer.x.com/).

Add dependencies to `agent/package.json` in **eliza**
```json
{
    "name": "@elizaos/agent",
    ...
    "dependencies": {
        ...
        "@elizaos/plugin-verifiable-twitter": "github:automata-network/eliza-plugin-verifiable-twitter"
    },
    ...
}
```

Add plugin and secret to character configuration
```json
{
    "name": "MyAgent",
    "settings": {
        ...
        "secrets": {
            "TWITTER_CONSUMER_KEY": "",
            "TWITTER_CONSUMER_SECRET": "",
            "TWITTER_ACCESS_TOKEN": "",
            "TWITTER_ACCESS_TOKEN_SECRET": ""
        }
    },
    "plugins": [
        "@elizaos/plugin-verifiable-twitter"
    ]
}
```

**Note:** If you have already set the secrets in .env, you don't need to set them again in the character configuration.


## Installation

To install the plugin, use the following command:

```bash
pnpm install @elizaos/plugin-verifiable-twitter
```


## Development

To build the project, run:

```bash
pnpm build
```

## Contributing

Contributions are welcome! Please follow the guidelines in the `CONTRIBUTING.md` file.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
