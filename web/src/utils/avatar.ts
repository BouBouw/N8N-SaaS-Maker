/**
 * Get the full avatar URL from either a Discord hash or a full URL
 * @param avatar - Discord avatar hash, full URL, or base64 data URL
 * @param discordId - Discord user ID (required if avatar is a hash)
 * @returns Full avatar URL or null
 */
export function getAvatarUrl(avatar: string | null | undefined, discordId?: string | null): string | null {
    if (!avatar) {
        return null;
    }

    // If it's a base64 data URL (from file upload preview), return as is
    if (avatar.startsWith('data:image/')) {
        return avatar;
    }

    // If it's already a full URL, return as is
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
        return avatar;
    }

    // If we have a discord_id, construct Discord CDN URL
    if (discordId) {
        return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`;
    }

    // If it looks like a path, return as is
    if (avatar.startsWith('/')) {
        return avatar;
    }

    // Otherwise, assume it's a Discord hash but we don't have the ID
    // Return null as we can't construct the URL
    return null;
}

/**
 * Get avatar initials from name
 * @param name - User name
 * @returns First letter of name in uppercase
 */
export function getAvatarInitials(name: string): string {
    return name.charAt(0).toUpperCase();
}
