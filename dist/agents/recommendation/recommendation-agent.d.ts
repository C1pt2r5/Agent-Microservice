/**
 * Recommendation agent implementation with AI-powered personalization
 */
import { ConcreteBaseAgent } from '../base/base-agent';
import { AgentRequest, AgentResponse } from '../../types';
export interface User {
    userId: string;
    demographics: {
        age?: number;
        gender?: string;
        location?: string;
        income?: string;
        occupation?: string;
    };
    preferences: {
        categories: string[];
        brands: string[];
        priceRange: {
            min: number;
            max: number;
        };
        features: string[];
    };
    behavior: {
        purchaseHistory: Purchase[];
        browsingHistory: BrowsingEvent[];
        interactionHistory: InteractionEvent[];
    };
    profile: {
        riskTolerance?: 'low' | 'medium' | 'high';
        investmentGoals?: string[];
        lifestage?: string;
        financialGoals?: string[];
    };
}
export interface Product {
    productId: string;
    name: string;
    category: string;
    subcategory?: string;
    brand: string;
    price: number;
    features: string[];
    description: string;
    tags: string[];
    availability: boolean;
    rating: number;
    reviewCount: number;
    metadata: Record<string, any>;
}
export interface FinancialProduct {
    productId: string;
    name: string;
    type: 'savings' | 'investment' | 'loan' | 'insurance' | 'credit';
    category: string;
    features: string[];
    requirements: {
        minAge?: number;
        minIncome?: number;
        creditScore?: number;
        employment?: string[];
    };
    terms: {
        interestRate?: number;
        fees?: number[];
        duration?: string;
        minimumAmount?: number;
    };
    riskLevel: 'low' | 'medium' | 'high';
    description: string;
    benefits: string[];
    eligibility: string[];
}
export interface Purchase {
    purchaseId: string;
    productId: string;
    userId: string;
    amount: number;
    timestamp: Date;
    category: string;
    rating?: number;
    review?: string;
}
export interface BrowsingEvent {
    eventId: string;
    userId: string;
    productId: string;
    action: 'view' | 'click' | 'add_to_cart' | 'remove_from_cart' | 'wishlist';
    timestamp: Date;
    duration?: number;
    metadata?: Record<string, any>;
}
export interface InteractionEvent {
    eventId: string;
    userId: string;
    type: 'search' | 'filter' | 'sort' | 'compare' | 'share';
    data: Record<string, any>;
    timestamp: Date;
}
export interface Recommendation {
    recommendationId: string;
    userId: string;
    productId: string;
    score: number;
    confidence: number;
    reasoning: string;
    algorithm: string;
    context: RecommendationContext;
    metadata: Record<string, any>;
}
export interface RecommendationContext {
    sessionId?: string;
    currentPage?: string;
    recentViews?: string[];
    cartItems?: string[];
    searchQuery?: string;
    filters?: Record<string, any>;
    timeOfDay?: string;
    dayOfWeek?: string;
}
export interface RecommendationRequest {
    userId: string;
    context: RecommendationContext;
    count: number;
    type: 'general' | 'similar' | 'complementary' | 'trending' | 'personalized' | 'financial';
    filters?: {
        categories?: string[];
        priceRange?: {
            min: number;
            max: number;
        };
        brands?: string[];
        features?: string[];
    };
    excludeProducts?: string[];
}
export interface RecommendationResponse {
    recommendations: Recommendation[];
    totalCount: number;
    algorithms: string[];
    processingTime: number;
    cacheHit: boolean;
}
export interface SimilarityScore {
    userId1: string;
    userId2: string;
    score: number;
    commonItems: string[];
    algorithm: 'cosine' | 'pearson' | 'jaccard';
}
export interface ItemSimilarity {
    productId1: string;
    productId2: string;
    score: number;
    reasons: string[];
    algorithm: 'content' | 'collaborative' | 'hybrid';
}
export declare class RecommendationAgent extends ConcreteBaseAgent {
    private userSimilarityCache;
    private itemSimilarityCache;
    private recommendationCache;
    private cacheTimeout;
    private algorithms;
    /**
     * Generate recommendations for a user
     */
    generateRecommendations(request: RecommendationRequest): Promise<RecommendationResponse>;
    /**
     * Generate collaborative filtering recommendations
     */
    private generateCollaborativeRecommendations;
    /**
     * Generate content-based recommendations
     */
    private generateContentBasedRecommendations;
    /**
     * Generate AI-powered personalized recommendations
     */
    private generateAIRecommendations;
    /**
     * Merge and rank recommendations from different algorithms
     */
    private mergeAndRankRecommendations;
    /**
     * Apply diversity filter to avoid too many similar products
     */
    private applyDiversityFilter;
    /**
     * Find users similar to the given user
     */
    private findSimilarUsers;
    /**
     * Calculate similarity between two users based on their purchases
     */
    private calculateUserSimilarity;
    /**
     * Build user preference profile from behavior data
     */
    private buildUserPreferenceProfile;
    /**
     * Calculate content-based similarity score
     */
    private calculateContentSimilarityScore;
    private getUserProfile;
    private getAvailableProducts;
    private applyClientSideFilters;
    private applyProductExclusions;
    private getUserPurchases;
    private getOtherUsersWithPurchases;
    private getProductsLikedBySimilarUsers;
    private calculateCollaborativeScore;
    private generateContentBasedReasoning;
    private calculateContentConfidence;
    private getMatchedFeatures;
    private prepareUserContextForAI;
    private getDefaultUserProfile;
    private getFallbackRecommendations;
    private generateCacheKey;
    private isCacheValid;
    private isSimilarityCacheValid;
    processRequest(request: AgentRequest): Promise<AgentResponse>;
    private createSuccessResponse;
    /**
     * Get session statistics for monitoring
     */
    getSessionStatistics(): any;
    private createErrorResponse;
}
//# sourceMappingURL=recommendation-agent.d.ts.map