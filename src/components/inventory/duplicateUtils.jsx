// Normalization and duplicate detection utilities

const STOP_WORDS = [
    'frisch', 'bio', 'neu', 'hausgemacht', 'regional',
    'kg', 'g', 'l', 'ml', 'stk', 'pcs', 'stück'
];

/**
 * Normalize string for comparison
 */
export function normalizeString(str) {
    if (!str) return '';
    
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Remove stop words from normalized string
 */
export function removeStopWords(normalized) {
    const words = normalized.split(' ');
    return words
        .filter(word => !STOP_WORDS.includes(word))
        .join(' ');
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[len1][len2];
}

/**
 * Calculate similarity percentage between two strings
 */
export function calculateSimilarity(str1, str2) {
    const normalized1 = removeStopWords(normalizeString(str1));
    const normalized2 = removeStopWords(normalizeString(str2));
    
    if (!normalized1 || !normalized2) return 0;
    
    const distance = levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    return ((maxLength - distance) / maxLength) * 100;
}

/**
 * Check if two articles are exact duplicates
 */
export function isExactDuplicate(article1, article2, currentArticleId = null) {
    // Don't compare article with itself when editing
    if (currentArticleId && article2.id === currentArticleId) {
        return false;
    }
    
    // Support both 'name' and 'display_name' fields
    const name1 = normalizeString(article1.name || article1.display_name);
    const name2 = normalizeString(article2.name || article2.display_name);
    
    return (
        name1 === name2 &&
        article1.supplier_id === article2.supplier_id &&
        article1.category_id === article2.category_id &&
        (article1.unit_id === article2.unit_id || article1.unit_abbreviation === article2.unit_abbreviation)
    );
}

/**
 * Find similar articles (>80% similarity threshold)
 */
export function findSimilarArticles(articleData, existingArticles, currentArticleId = null, threshold = 80) {
    const similar = [];
    const articleName = articleData.name || articleData.display_name;
    
    for (const existing of existingArticles) {
        // Skip if comparing with itself
        if (currentArticleId && existing.id === currentArticleId) {
            continue;
        }
        
        const existingName = existing.name || existing.display_name;
        const similarity = calculateSimilarity(articleName, existingName);
        
        if (similarity >= threshold) {
            similar.push({
                ...existing,
                name: existingName, // Normalize the name field
                similarity
            });
        }
    }
    
    // Sort by similarity (highest first)
    return similar.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Check for duplicates in current outlet context
 */
export function checkDuplicates(articleData, allArticles, outletId, currentArticleId = null) {
    if (!allArticles || allArticles.length === 0) {
        return null;
    }
    
    // Filter articles to current outlet only
    const outletArticles = allArticles.filter(a => {
        // For OutletItem structure
        if (a.outlet_id) {
            return a.outlet_id === outletId && a.is_active !== false;
        }
        // For Article structure (legacy or different structure)
        return a.is_active !== false;
    });
    
    // Normalize the input article data to have consistent field names
    const normalizedArticleData = {
        name: articleData.name || articleData.display_name,
        supplier_id: articleData.supplier_id,
        category_id: articleData.category_id,
        unit_id: articleData.unit_id,
        unit_abbreviation: articleData.unit_abbreviation
    };
    
    // Check for exact duplicates
    const exactDuplicate = outletArticles.find(existing => 
        isExactDuplicate(normalizedArticleData, existing, currentArticleId)
    );
    
    if (exactDuplicate) {
        return {
            type: 'exact',
            duplicate: {
                ...exactDuplicate,
                name: exactDuplicate.name || exactDuplicate.display_name,
                category_name: exactDuplicate.category_name || 'Unbekannt',
                unit_abbreviation: exactDuplicate.unit_abbreviation || 'Unbekannt'
            }
        };
    }
    
    // Check for similar articles
    const similarArticles = findSimilarArticles(normalizedArticleData, outletArticles, currentArticleId);
    
    if (similarArticles.length > 0) {
        return {
            type: 'similar',
            articles: similarArticles.map(a => ({
                ...a,
                name: a.name || a.display_name,
                supplier_name: a.supplier_name || 'Unbekannt',
                category_name: a.category_name || 'Unbekannt',
                unit_abbreviation: a.unit_abbreviation || 'Unbekannt'
            }))
        };
    }
    
    return null;
}