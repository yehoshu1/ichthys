
import { EmbedBuilder } from "discord.js";

interface EmbedConfig {
    title?: string;
    description?: string;
    url?: string;
    color?: string;
    timestamp?: boolean;
    footer?: { text: string; icon_url?: string };
    thumbnail?: { url: string };
    image?: { url: string };
    author?: { name: string; url?: string; icon_url?: string };
    enabled?: boolean; // From our frontend logic
}

/**
 * Escape special regex characters in a string
 * This prevents regex injection if variable keys contain special characters
 */
function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function replaceVariables(text: string, variables: Record<string, string | number>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
        // Escape special regex characters in the key to prevent injection
        const escapedKey = escapeRegex(key);
        // Replace {key} globally
        const regex = new RegExp(`{${escapedKey}}`, 'g');
        result = result.replace(regex, String(value));
    }
    return result;
}

export function buildMessage(
    content: string | null,
    embedData: EmbedConfig | null | undefined, // The JSON object from DB
    variables: Record<string, string | number>
): { content?: string; embeds?: EmbedBuilder[] } | null {

    // If no content and no embed, nothing to send
    if (!content && (!embedData || !embedData.enabled && Object.keys(embedData).length === 0)) {
        return null;
    }

    const result: { content?: string; embeds?: EmbedBuilder[] } = {};

    // Process Content
    if (content) {
        result.content = replaceVariables(content, variables);
    }

    // Process Embed
    // We check either explicit 'enabled' flag or if there are substantive fields
    const isEmbedEnabled = embedData?.enabled || (embedData && (embedData.title || embedData.description));

    if (isEmbedEnabled && embedData) {
        const embed = new EmbedBuilder();

        if (embedData.title) embed.setTitle(replaceVariables(embedData.title, variables));
        if (embedData.description) embed.setDescription(replaceVariables(embedData.description, variables));
        if (embedData.url) embed.setURL(replaceVariables(embedData.url, variables));
        if (embedData.color) embed.setColor(embedData.color as any);
        if (embedData.timestamp) embed.setTimestamp();

        if (embedData.footer && embedData.footer.text) {
            embed.setFooter({
                text: replaceVariables(embedData.footer.text, variables),
                iconURL: embedData.footer.icon_url
            });
        }

        if (embedData.thumbnail && embedData.thumbnail.url) {
            embed.setThumbnail(embedData.thumbnail.url);
        }

        if (embedData.image && embedData.image.url) {
            embed.setImage(embedData.image.url);
        }

        if (embedData.author && embedData.author.name) {
            embed.setAuthor({
                name: replaceVariables(embedData.author.name, variables),
                url: embedData.author.url,
                iconURL: embedData.author.icon_url
            });
        }

        result.embeds = [embed];
    }

    if (!result.content && (!result.embeds || result.embeds.length === 0)) return null;

    return result;
}
