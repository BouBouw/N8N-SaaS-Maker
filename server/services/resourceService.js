const pool = require('../config/database');

class ResourceService {
    /**
     * Create a new resource
     */
    async createResource(userId, { type, title, description, content, tags, price = 'free', priceAmount = 0 }) {
        try {
            const [result] = await pool.query(
                `INSERT INTO resources 
                (user_id, type, title, description, content, tags, price, price_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    type,
                    title,
                    description,
                    content,
                    tags ? JSON.stringify(tags) : null,
                    price,
                    priceAmount
                ]
            );

            console.log(`✅ Resource created: ${result.insertId}`);
            return result.insertId;
        } catch (error) {
            console.error('❌ Error creating resource:', error);
            throw error;
        }
    }

    /**
     * Get all public resources with filters
     */
    async getResources({ type, price, search, limit = 50, offset = 0 }) {
        try {
            let query = `
                SELECT 
                    r.*,
                    u.name as author_name,
                    u.avatar as author_avatar,
                    u.discord_id as author_discord_id,
                    (SELECT COUNT(*) FROM resource_likes WHERE resource_id = r.id) as likes_count
                FROM resources r
                LEFT JOIN users u ON r.user_id = u.id
                WHERE r.is_public = TRUE
            `;
            const params = [];

            if (type && type !== 'all') {
                query += ` AND r.type = ?`;
                params.push(type);
            }

            if (price && price !== 'all') {
                query += ` AND r.price = ?`;
                params.push(price);
            }

            if (search) {
                query += ` AND (r.title LIKE ? OR r.description LIKE ?)`;
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern);
            }

            query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const [resources] = await pool.query(query, params);
            return resources;
        } catch (error) {
            console.error('❌ Error fetching resources:', error);
            throw error;
        }
    }

    /**
     * Get resource by ID
     */
    async getResourceById(resourceId, incrementView = true) {
        try {
            const [resources] = await pool.query(
                `SELECT 
                    r.*,
                    u.name as author_name,
                    u.avatar as author_avatar,
                    (SELECT COUNT(*) FROM resource_likes WHERE resource_id = r.id) as likes_count
                FROM resources r
                LEFT JOIN users u ON r.user_id = u.id
                WHERE r.id = ?`,
                [resourceId]
            );

            if (resources.length === 0) {
                throw new Error('Resource not found');
            }

            // Increment view count
            if (incrementView) {
                await pool.query(
                    `UPDATE resources SET views_count = views_count + 1 WHERE id = ?`,
                    [resourceId]
                );
            }

            return resources[0];
        } catch (error) {
            console.error('❌ Error fetching resource:', error);
            throw error;
        }
    }

    /**
     * Get user's resources
     */
    async getUserResources(userId) {
        try {
            const [resources] = await pool.query(
                `SELECT 
                    r.*,
                    u.name as author_name,
                    u.avatar as author_avatar,
                    (SELECT COUNT(*) FROM resource_likes WHERE resource_id = r.id) as likes_count
                FROM resources r
                LEFT JOIN users u ON r.user_id = u.id
                WHERE r.user_id = ?
                ORDER BY r.created_at DESC`,
                [userId]
            );

            return resources;
        } catch (error) {
            console.error('❌ Error fetching user resources:', error);
            throw error;
        }
    }

    /**
     * Update resource
     */
    async updateResource(resourceId, userId, updates) {
        try {
            const { title, description, content, tags, price, priceAmount, isPublic } = updates;
            
            await pool.query(
                `UPDATE resources 
                SET title = ?, description = ?, content = ?, tags = ?, 
                    price = ?, price_amount = ?, is_public = ?
                WHERE id = ? AND user_id = ?`,
                [
                    title,
                    description,
                    content,
                    tags ? JSON.stringify(tags) : null,
                    price,
                    priceAmount,
                    isPublic,
                    resourceId,
                    userId
                ]
            );

            console.log(`✅ Resource updated: ${resourceId}`);
        } catch (error) {
            console.error('❌ Error updating resource:', error);
            throw error;
        }
    }

    /**
     * Delete resource
     */
    async deleteResource(resourceId, userId) {
        try {
            await pool.query(
                `DELETE FROM resources WHERE id = ? AND user_id = ?`,
                [resourceId, userId]
            );

            console.log(`✅ Resource deleted: ${resourceId}`);
        } catch (error) {
            console.error('❌ Error deleting resource:', error);
            throw error;
        }
    }

    /**
     * Toggle like on resource
     */
    async toggleLike(resourceId, userId) {
        try {
            // Check if already liked
            const [existing] = await pool.query(
                `SELECT id FROM resource_likes WHERE resource_id = ? AND user_id = ?`,
                [resourceId, userId]
            );

            if (existing.length > 0) {
                // Unlike
                await pool.query(
                    `DELETE FROM resource_likes WHERE resource_id = ? AND user_id = ?`,
                    [resourceId, userId]
                );
                return { liked: false };
            } else {
                // Like
                await pool.query(
                    `INSERT INTO resource_likes (resource_id, user_id) VALUES (?, ?)`,
                    [resourceId, userId]
                );
                return { liked: true };
            }
        } catch (error) {
            console.error('❌ Error toggling like:', error);
            throw error;
        }
    }

    /**
     * Check if user liked resource
     */
    async isLikedByUser(resourceId, userId) {
        try {
            const [likes] = await pool.query(
                `SELECT id FROM resource_likes WHERE resource_id = ? AND user_id = ?`,
                [resourceId, userId]
            );
            return likes.length > 0;
        } catch (error) {
            console.error('❌ Error checking like:', error);
            return false;
        }
    }

    /**
     * Increment download count
     */
    async incrementDownload(resourceId) {
        try {
            await pool.query(
                `UPDATE resources SET downloads_count = downloads_count + 1 WHERE id = ?`,
                [resourceId]
            );
        } catch (error) {
            console.error('❌ Error incrementing download:', error);
        }
    }

    /**
     * Get resource statistics
     */
    async getStats() {
        try {
            const [stats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_resources,
                    SUM(CASE WHEN type = 'workflow' THEN 1 ELSE 0 END) as total_workflows,
                    SUM(CASE WHEN type = 'prompt' THEN 1 ELSE 0 END) as total_prompts,
                    SUM(downloads_count) as total_downloads
                FROM resources
                WHERE is_public = TRUE
            `);

            return stats[0];
        } catch (error) {
            console.error('❌ Error fetching stats:', error);
            throw error;
        }
    }

    /**
     * Update forum thread ID for a resource
     */
    async updateForumThreadId(resourceId, threadId) {
        try {
            await pool.query(
                'UPDATE resources SET forum_thread_id = ? WHERE id = ?',
                [threadId, resourceId]
            );
            console.log(`✅ Forum thread ID updated for resource ${resourceId}: ${threadId}`);
        } catch (error) {
            console.error('❌ Error updating forum thread ID:', error);
            throw error;
        }
    }
}

module.exports = new ResourceService();
