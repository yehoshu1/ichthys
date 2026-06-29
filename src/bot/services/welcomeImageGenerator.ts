import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';
import type { WelcomeConfig } from '../../shared/database/schema';
import logger from '../utils/logger';

/**
 * Options for generating welcome image
 */
export interface WelcomeImageOptions {
    username: string;
    discriminator?: string;
    avatarUrl: string;
    serverName: string;
    memberCount: number;
    config: WelcomeConfig;
    prefix?: string;
}

/**
 * Result of image generation
 */
export interface WelcomeImageResult {
    buffer: Buffer;
    format: 'png';
    width: number;
    height: number;
}

// Default dimensions (ProBot-style, customizable)
const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 500;

// Dimension limits
const MIN_DIMENSION = 100;
const MAX_DIMENSION = 2000;

/**
 * Generate a welcome image card
 */
export async function generateWelcomeImage(
    options: WelcomeImageOptions
): Promise<WelcomeImageResult | null> {
    try {
        const { username, discriminator, avatarUrl, serverName, memberCount, config } = options;

        // Use configurable canvas dimensions (ProBot-style)
        const width = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, config.canvasWidth || DEFAULT_WIDTH));
        const height = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, config.canvasHeight || DEFAULT_HEIGHT));

        // Create canvas with custom dimensions
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Clip the entire canvas to have rounded corners
        ctx.beginPath();
        const radius = 20;
        ctx.moveTo(radius, 0);
        ctx.lineTo(width - radius, 0);
        ctx.quadraticCurveTo(width, 0, width, radius);
        ctx.lineTo(width, height - radius);
        ctx.quadraticCurveTo(width, height, width - radius, height);
        ctx.lineTo(radius, height);
        ctx.quadraticCurveTo(0, height, 0, height - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.clip();

        // Draw background
        await drawBackground(ctx, config);

        // Draw avatar
        await drawAvatar(ctx, avatarUrl, config);

        // Draw username
        drawUsername(ctx, username, discriminator, config);

        // Draw subtitle
        if (config.subtitleEnabled && config.subtitleTemplate) {
            drawSubtitle(ctx, config.subtitleTemplate, serverName, memberCount, config);
        }

        // Draw server name if enabled
        if (config.showServerName) {
            drawServerName(ctx, serverName, config);
        }

        // Convert to buffer
        const buffer = canvas.toBuffer('image/png');

        return {
            buffer,
            format: 'png',
            width: canvas.width,
            height: canvas.height
        };
    } catch (error) {
        logger.error('Failed to generate welcome image:', error);
        return null;
    }
}

/**
 * Draw background based on configuration
 */
async function drawBackground(
    ctx: CanvasRenderingContext2D,
    config: WelcomeConfig
): Promise<void> {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Handle transparent background
    if (config.backgroundType === 'COLOR' && config.backgroundValue === 'transparent') {
        ctx.clearRect(0, 0, width, height);
        return;
    }

    switch (config.backgroundType) {
        case 'COLOR':
            ctx.fillStyle = config.backgroundValue || '#36393f';
            ctx.fillRect(0, 0, width, height);
            break;

        case 'GRADIENT':
            drawGradientBackground(ctx, config.backgroundValue, width, height);
            break;

        case 'IMAGE':
            await drawImageBackground(ctx, config.backgroundValue, width, height);
            break;

    default:
            ctx.fillStyle = '#36393f';
            ctx.fillRect(0, 0, width, height);
    }

    // Add semi-transparent inset overlay for better text readability
    const opacity = typeof config.overlayOpacity === 'number' ? config.overlayOpacity / 100 : 0.5;
    if (opacity > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        // Use a proportional margin so small canvases don't get squished
        const margin = Math.max(15, Math.min(width, height) * 0.05);
        const overlayRadius = 15;
        
        ctx.beginPath();
        ctx.moveTo(margin + overlayRadius, margin);
        ctx.lineTo(width - margin - overlayRadius, margin);
        ctx.quadraticCurveTo(width - margin, margin, width - margin, margin + overlayRadius);
        ctx.lineTo(width - margin, height - margin - overlayRadius);
        ctx.quadraticCurveTo(width - margin, height - margin, width - margin - overlayRadius, height - margin);
        ctx.lineTo(margin + overlayRadius, height - margin);
        ctx.quadraticCurveTo(margin, height - margin, margin, height - margin - overlayRadius);
        ctx.lineTo(margin, margin + overlayRadius);
        ctx.quadraticCurveTo(margin, margin, margin + overlayRadius, margin);
        ctx.closePath();
        ctx.fill();
    }
}

/**
 * Draw gradient background
 */
function drawGradientBackground(
    ctx: CanvasRenderingContext2D,
    gradientValue: string | null,
    width: number,
    height: number
): void {
    // Parse gradient value (format: "color1,color2,angle" or "color1,color2")
    const colors = gradientValue?.split(',') || ['#7289da', '#4e5d94'];
    const color1 = colors[0]?.trim() || '#7289da';
    const color2 = colors[1]?.trim() || '#4e5d94';
    const angle = parseInt(colors[2]) || 45;

    // Convert angle to radians
    const radians = (angle * Math.PI) / 180;

    // Calculate gradient start and end points
    const x1 = width / 2 - Math.cos(radians) * width / 2;
    const y1 = height / 2 - Math.sin(radians) * height / 2;
    const x2 = width / 2 + Math.cos(radians) * width / 2;
    const y2 = height / 2 + Math.sin(radians) * height / 2;

    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

/**
 * Draw image background
 */
async function drawImageBackground(
    ctx: CanvasRenderingContext2D,
    imageUrl: string | null,
    width: number,
    height: number
): Promise<void> {
    try {
        if (!imageUrl) {
            throw new Error('No image URL provided');
        }

        // Load image
        const image = await loadImage(imageUrl);

        // Calculate dimensions to cover the canvas (object-fit: cover)
        const scale = Math.max(width / image.width, height / image.height);
        const scaledWidth = image.width * scale;
        const scaledHeight = image.height * scale;
        const x = (width - scaledWidth) / 2;
        const y = (height - scaledHeight) / 2;

        ctx.drawImage(image, x, y, scaledWidth, scaledHeight);
    } catch (error) {
        logger.warn('Failed to load background image:', error);
        // Fallback to solid color
        ctx.fillStyle = '#36393f';
        ctx.fillRect(0, 0, width, height);
    }
}

/**
 * Draw user avatar
 */
async function drawAvatar(
    ctx: CanvasRenderingContext2D,
    avatarUrl: string,
    config: WelcomeConfig
): Promise<void> {
    try {
        const x = config.avatarX ?? 150;
        const y = config.avatarY ?? 150;
        const size = config.avatarSize ?? 128;
        const borderWidth = config.avatarBorderWidth ?? 4;

        // Load avatar image
        const avatar = await loadImage(avatarUrl);

        // Create circular/rounded clipping path
        ctx.save();

        const radius = size / 2;
        const centerX = x + radius;
        const centerY = y + radius;

        ctx.beginPath();

        switch (config.avatarShape) {
            case 'CIRCLE':
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                break;
            case 'SQUARE':
                ctx.rect(x, y, size, size);
                break;
            case 'ROUNDED':
                roundRect(ctx, x, y, size, size, 20);
                break;
            default:
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        }

        ctx.closePath();
        ctx.clip();

        // Draw avatar
        ctx.drawImage(avatar, x, y, size, size);

        ctx.restore();

        // Draw border
        if (borderWidth > 0) {
            ctx.strokeStyle = config.avatarBorderColor || '#ffffff';
            ctx.lineWidth = borderWidth;

            ctx.beginPath();
            switch (config.avatarShape) {
                case 'CIRCLE':
                    ctx.arc(centerX, centerY, radius + borderWidth / 2, 0, Math.PI * 2);
                    break;
                case 'SQUARE':
                    ctx.rect(x - borderWidth / 2, y - borderWidth / 2, size + borderWidth, size + borderWidth);
                    break;
                case 'ROUNDED':
                    roundRect(ctx, x - borderWidth / 2, y - borderWidth / 2, size + borderWidth, size + borderWidth, 20);
                    break;
            }
            ctx.stroke();
        }
    } catch (error) {
        logger.warn('Failed to load avatar image:', error);
        // Draw placeholder
        const x = config.avatarX ?? 150;
        const y = config.avatarY ?? 150;
        const size = config.avatarSize ?? 128;

        ctx.fillStyle = '#7289da';
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `${size / 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x + size / 2, y + size / 2);
    }
}

/**
 * Draw username text
 */
function drawUsername(
    ctx: CanvasRenderingContext2D,
    username: string,
    discriminator: string | undefined,
    config: WelcomeConfig
): void {
    const x = config.usernameX ?? 300;
    const y = config.usernameY ?? 130;
    const fontSize = config.usernameSize ?? 32;
    const fontFamily = config.usernameFont || 'Arial';

    // Prepare text
    let displayName = username;
    if (discriminator && discriminator !== '0') {
        displayName += `#${discriminator}`;
    }

    // Set font
    ctx.font = `bold ${fontSize}px "${fontFamily}", Arial, sans-serif`;
    ctx.fillStyle = config.usernameColor || '#ffffff';
    ctx.textAlign = (config.usernameAlign as 'left' | 'center' | 'right') || 'left';
    ctx.textBaseline = 'middle';

    // Apply shadow for better readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Draw text
    ctx.fillText(displayName, x, y);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

/**
 * Draw subtitle text
 */
function drawSubtitle(
    ctx: CanvasRenderingContext2D,
    template: string,
    serverName: string,
    memberCount: number,
    config: WelcomeConfig
): void {
    const x = config.subtitleX ?? 300;
    const y = config.subtitleY ?? 180;
    const fontSize = config.subtitleSize ?? 24;
    const fontFamily = config.subtitleFont || 'Arial';

    // Replace variables
    let text = template
        .replace(/{server}/g, serverName)
        .replace(/{memberCount}/g, memberCount.toString());

    // Set font
    ctx.font = `${fontSize}px "${fontFamily}", Arial, sans-serif`;
    ctx.fillStyle = config.subtitleColor || '#cccccc';
    ctx.textAlign = (config.usernameAlign as 'left' | 'center' | 'right') || 'left';
    ctx.textBaseline = 'middle';

    // Apply shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Draw text
    ctx.fillText(text, x, y);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

/**
 * Draw server name
 */
function drawServerName(
    ctx: CanvasRenderingContext2D,
    serverName: string,
    config: WelcomeConfig
): void {
    const x = config.serverNameX ?? 300;
    const y = config.serverNameY ?? 80;
    const fontSize = config.serverNameSize ?? 28;
    const fontFamily = config.serverNameFont || 'Arial';

    // Set font
    ctx.font = `bold ${fontSize}px "${fontFamily}", Arial, sans-serif`;
    ctx.fillStyle = config.serverNameColor || '#ffffff';
    ctx.textAlign = (config.usernameAlign as 'left' | 'center' | 'right') || 'left';
    ctx.textBaseline = 'middle';

    // Apply shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Draw text
    ctx.fillText(serverName, x, y);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

/**
 * Helper function to draw rounded rectangle
 */
function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Process welcome message template with variables
 * Supports both ProBot-style [variable] and legacy {variable} formats
 */
export function processWelcomeTemplate(
    template: string,
    variables: {
        user: string;
        username: string;
        tag: string;
        server: string;
        memberCount: number;
        accountCreated?: string;
        joinDate?: string;
        inviter?: string;
    }
): string {
    let result = template;

    // Support both [variable] (ProBot style) and {variable} (legacy) formats
    const replacements: Record<string, string> = {
        '[user]': variables.user,
        '[username]': variables.username,
        '[tag]': variables.tag,
        '[server]': variables.server,
        '[memberCount]': variables.memberCount.toString(),
        '[accountCreated]': variables.accountCreated || '',
        '[joinDate]': variables.joinDate || '',
        '[inviter]': variables.inviter || 'Unknown',
        // Legacy format support
        '{user}': variables.user,
        '{username}': variables.username,
        '{tag}': variables.tag,
        '{server}': variables.server,
        '{memberCount}': variables.memberCount.toString(),
        '{accountCreated}': variables.accountCreated || '',
        '{joinDate}': variables.joinDate || '',
        '{inviter}': variables.inviter || 'Unknown',
    };

    for (const [key, value] of Object.entries(replacements)) {
        result = result.replaceAll(key, value);
    }

    return result;
}
