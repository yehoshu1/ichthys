/**
 * Content sanitization utilities for the bot
 * Provides safe content validation and sanitization
 */

/**
 * Sanitize message content to prevent abuse
 */
export function sanitizeContent(content: string): string {
    // Remove any potential malicious content
    // Limit length to prevent spam
    let sanitized = content.substring(0, 2000); // Discord message limit
    
    // Remove potential command injection patterns
    sanitized = sanitized.replace(/@\s*(everyone|here)/gi, '@\u200B$1'); // Zero-width space to prevent mentions
    sanitized = sanitized.replace(/<(https?:\/\/[^>\s]+)>/g, '$1'); // Remove angle brackets around URLs
    
    return sanitized;
}

/**
 * Validate embed content to ensure it's safe
 */
export function validateEmbed(embed: any): boolean {
    if (!embed) return true;
    
    // Check for unsafe properties
    if (embed.fields && Array.isArray(embed.fields)) {
        for (const field of embed.fields as Array<{ value?: string; name?: string }>) {
            if (field.value && typeof field.value === 'string') {
                if (field.value.length > 1024) return false;
            }
            if (field.name && typeof field.name === 'string') {
                if (field.name.length > 256) return false;
            }
        }
    }
    
    if (embed.description && typeof embed.description === 'string') {
        if (embed.description.length > 4096) return false;
    }
    
    if (embed.title && typeof embed.title === 'string') {
        if (embed.title.length > 256) return false;
    }
    
    return true;
}

/**
 * Sanitize embed content
 */
export function sanitizeEmbed(embed: any): any {
    if (!embed) return embed;
    
    const sanitized = { ...embed };
    
    if (sanitized.fields && Array.isArray(sanitized.fields)) {
        sanitized.fields = (sanitized.fields as Array<{ value?: string; name?: string }>).map(field => {
            const sanitizedField = { ...field };
            if (sanitizedField.value && typeof sanitizedField.value === 'string') {
                sanitizedField.value = sanitizedField.value.substring(0, 1024);
            }
            if (sanitizedField.name && typeof sanitizedField.name === 'string') {
                sanitizedField.name = sanitizedField.name.substring(0, 256);
            }
            return sanitizedField;
        });
    }
    
    if (sanitized.description && typeof sanitized.description === 'string') {
        sanitized.description = sanitized.description.substring(0, 4096);
    }
    
    if (sanitized.title && typeof sanitized.title === 'string') {
        sanitized.title = sanitized.title.substring(0, 256);
    }
    
    return sanitized;
}