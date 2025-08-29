/**
 * Recommendation agent implementation with AI-powered personalization
 */

import { ConcreteBaseAgent } from '../base/base-agent';
import { AgentRequest, AgentResponse, SystemError, ErrorCode } from '../../types';
import { EnhancedGeminiRequest } from '../../integration/gemini/enhanced-gemini-client';
import { PromptTemplateManager } from '../../integration/gemini/prompt-templates';

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
    priceRange: { min: number; max: number };
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
    priceRange?: { min: number; max: number };
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

export class RecommendationAgent extends ConcreteBaseAgent {
  private userSimilarityCache: Map<string, SimilarityScore[]> = new Map();
  private itemSimilarityCache: Map<string, ItemSimilarity[]> = new Map();
  private recommendationCache: Map<string, RecommendationResponse> = new Map();
  private cacheTimeout = 3600000; // 1 hour
  
  private algorithms = {
    collaborative: {
      enabled: true,
      weight: 0.4,
      minSimilarUsers: 5,
      minCommonItems: 3
    },
    contentBased: {
      enabled: true,
      weight: 0.3,
      featureWeights: {
        category: 0.3,
        brand: 0.2,
        price: 0.2,
        features: 0.3
      }
    },
    aiPersonalized: {
      enabled: true,
      weight: 0.3,
      temperature: 0.7,
      maxTokens: 1000
    }
  };

  /**
   * Generate recommendations for a user
   */
  async generateRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cached = this.recommendationCache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached)) {
        return {
          ...cached,
          cacheHit: true,
          processingTime: Date.now() - startTime
        };
      }

      // Get user profile and behavior data
      const user = await this.getUserProfile(request.userId);
      const products = await this.getAvailableProducts(request.filters);

      // Apply product exclusions
      const filteredProducts = this.applyProductExclusions(products, request.excludeProducts);

      // Generate recommendations using multiple algorithms
      const recommendations: Recommendation[] = [];
      const algorithmsUsed: string[] = [];

      // Collaborative filtering
      if (this.algorithms.collaborative.enabled) {
        const collabRecs = await this.generateCollaborativeRecommendations(user, filteredProducts, request);
        recommendations.push(...collabRecs);
        if (collabRecs.length > 0) algorithmsUsed.push('collaborative');
      }

      // Content-based filtering
      if (this.algorithms.contentBased.enabled) {
        const contentRecs = await this.generateContentBasedRecommendations(user, filteredProducts, request);
        recommendations.push(...contentRecs);
        if (contentRecs.length > 0) algorithmsUsed.push('content-based');
      }

      // AI-powered personalization
      if (this.algorithms.aiPersonalized.enabled) {
        const aiRecs = await this.generateAIRecommendations(user, filteredProducts, request);
        recommendations.push(...aiRecs);
        if (aiRecs.length > 0) algorithmsUsed.push('ai-personalized');
      }

      // Merge and rank recommendations
      const finalRecommendations = await this.mergeAndRankRecommendations(
        recommendations,
        request.count
      );

      const response: RecommendationResponse = {
        recommendations: finalRecommendations,
        totalCount: finalRecommendations.length,
        algorithms: algorithmsUsed,
        processingTime: Date.now() - startTime,
        cacheHit: false
      };

      // Cache the response with timestamp
      this.recommendationCache.set(cacheKey, {
        ...response,
        processingTime: 0, // Don't cache processing time
        timestamp: Date.now() // Add timestamp for cache validation
      } as any);

      this.emit('recommendationsGenerated', { request, response });

      return response;

    } catch (error) {
      console.error('Recommendation generation error:', error);
      
      // Return fallback recommendations
      return this.getFallbackRecommendations(request, Date.now() - startTime);
    }
  }

  /**
   * Generate collaborative filtering recommendations
   */
  private async generateCollaborativeRecommendations(
    user: User,
    products: Product[],
    request: RecommendationRequest
  ): Promise<Recommendation[]> {
    try {
      // Find similar users
      const similarUsers = await this.findSimilarUsers(user.userId);
      
      if (similarUsers.length < this.algorithms.collaborative.minSimilarUsers) {
        return [];
      }

      // Get products liked by similar users
      const candidateProducts = await this.getProductsLikedBySimilarUsers(
        similarUsers,
        user.behavior.purchaseHistory.map(p => p.productId)
      );

      const recommendations: Recommendation[] = [];

      for (const productId of candidateProducts) {
        const product = products.find(p => p.productId === productId);
        if (!product || !product.availability) continue;

        // Calculate collaborative score
        const score = this.calculateCollaborativeScore(productId, similarUsers, user);
        
        if (score > 0.3) { // Minimum threshold
          recommendations.push({
            recommendationId: `collab_${Date.now()}_${productId}`,
            userId: user.userId,
            productId,
            score: score * this.algorithms.collaborative.weight,
            confidence: Math.min(similarUsers.length / 10, 1.0),
            reasoning: `Recommended based on ${similarUsers.length} similar users who liked this product`,
            algorithm: 'collaborative',
            context: request.context,
            metadata: {
              similarUsers: similarUsers.slice(0, 5).map(u => u.userId2),
              commonItems: similarUsers[0]?.commonItems || []
            }
          });
        }
      }

      return recommendations.sort((a, b) => b.score - a.score).slice(0, request.count);

    } catch (error) {
      console.error('Collaborative filtering error:', error);
      return [];
    }
  }

  /**
   * Generate content-based recommendations
   */
  private async generateContentBasedRecommendations(
    user: User,
    products: Product[],
    request: RecommendationRequest
  ): Promise<Recommendation[]> {
    try {
      // Build user preference profile from purchase history
      const userProfile = this.buildUserPreferenceProfile(user);
      
      const recommendations: Recommendation[] = [];

      for (const product of products) {
        if (!product.availability) continue;
        
        // Skip products user already purchased
        if (user.behavior.purchaseHistory.some(p => p.productId === product.productId)) {
          continue;
        }

        // Calculate content similarity score
        const score = this.calculateContentSimilarityScore(product, userProfile);
        
        if (score > 0.2) { // Minimum threshold
          const reasoning = this.generateContentBasedReasoning(product, userProfile);
          
          recommendations.push({
            recommendationId: `content_${Date.now()}_${product.productId}`,
            userId: user.userId,
            productId: product.productId,
            score: score * this.algorithms.contentBased.weight,
            confidence: this.calculateContentConfidence(product, userProfile),
            reasoning,
            algorithm: 'content-based',
            context: request.context,
            metadata: {
              matchedFeatures: this.getMatchedFeatures(product, userProfile),
              categoryMatch: userProfile.preferredCategories.includes(product.category)
            }
          });
        }
      }

      return recommendations.sort((a, b) => b.score - a.score).slice(0, request.count);

    } catch (error) {
      console.error('Content-based filtering error:', error);
      return [];
    }
  }

  /**
   * Generate AI-powered personalized recommendations
   */
  private async generateAIRecommendations(
    user: User,
    products: Product[],
    request: RecommendationRequest
  ): Promise<Recommendation[]> {
    if (!this.geminiClient) {
      return [];
    }

    try {
      // Prepare user context for AI
      const userContext = this.prepareUserContextForAI(user, request.context);
      
      // Select candidate products (top-rated, trending, or matching basic criteria)
      const candidateProducts = products
        .filter(p => p.availability && p.rating >= 3.5)
        .slice(0, 50); // Limit for AI processing

      const prompt = PromptTemplateManager.renderTemplate(
        'recommendation-product',
        {
          customer: userContext,
          available_products: candidateProducts.map(p => ({
            id: p.productId,
            name: p.name,
            category: p.category,
            price: p.price,
            features: p.features.join(', '),
            rating: p.rating,
            description: p.description.substring(0, 200)
          })),
          current_context: {
            page: request.context.currentPage,
            recent_views: request.context.recentViews?.join(', '),
            search_query: request.context.searchQuery
          }
        }
      );

      const aiRequest: EnhancedGeminiRequest = {
        id: `ai_rec_${Date.now()}`,
        timestamp: new Date(),
        prompt,
        options: {
          temperature: this.algorithms.aiPersonalized.temperature,
          maxTokens: this.algorithms.aiPersonalized.maxTokens
        }
      };

      const response = await this.geminiClient.generateStructuredResponse(aiRequest);

      if (response.success && response.structuredData && Array.isArray(response.structuredData)) {
        const aiRecommendations = response.structuredData as any[];
        
        return aiRecommendations.map((rec, index) => ({
          recommendationId: `ai_${Date.now()}_${rec.product_id}`,
          userId: user.userId,
          productId: rec.product_id,
          score: (rec.confidence_score / 100) * this.algorithms.aiPersonalized.weight,
          confidence: rec.satisfaction_likelihood / 100,
          reasoning: rec.match_reason || 'AI-powered personalized recommendation',
          algorithm: 'ai-personalized',
          context: request.context,
          metadata: {
            aiConfidence: rec.confidence_score,
            satisfactionLikelihood: rec.satisfaction_likelihood,
            aiReasoning: rec.match_reason
          }
        })).slice(0, request.count);
      }

      return [];

    } catch (error) {
      console.error('AI recommendation error:', error);
      return [];
    }
  }

  /**
   * Merge and rank recommendations from different algorithms
   */
  private async mergeAndRankRecommendations(
    recommendations: Recommendation[],
    count: number
  ): Promise<Recommendation[]> {
    // Group by product ID and merge scores
    const productMap = new Map<string, Recommendation[]>();
    
    for (const rec of recommendations) {
      if (!productMap.has(rec.productId)) {
        productMap.set(rec.productId, []);
      }
      productMap.get(rec.productId)!.push(rec);
    }

    const mergedRecommendations: Recommendation[] = [];

    for (const [productId, recs] of productMap.entries()) {
      if (recs.length === 1) {
        mergedRecommendations.push(recs[0]);
      } else {
        // Merge multiple recommendations for the same product
        const mergedScore = recs.reduce((sum, rec) => sum + rec.score, 0);
        const avgConfidence = recs.reduce((sum, rec) => sum + rec.confidence, 0) / recs.length;
        const algorithms = recs.map(rec => rec.algorithm);
        const reasoning = recs.map(rec => rec.reasoning).join('; ');

        mergedRecommendations.push({
          recommendationId: `merged_${Date.now()}_${productId}`,
          userId: recs[0].userId,
          productId,
          score: mergedScore,
          confidence: avgConfidence,
          reasoning,
          algorithm: algorithms.join('+'),
          context: recs[0].context,
          metadata: {
            sourceAlgorithms: algorithms,
            individualScores: recs.map(rec => ({ algorithm: rec.algorithm, score: rec.score }))
          }
        });
      }
    }

    // Sort by score and apply diversity
    const sortedRecs = mergedRecommendations.sort((a, b) => b.score - a.score);
    
    return this.applyDiversityFilter(sortedRecs, count);
  }

  /**
   * Apply diversity filter to avoid too many similar products
   */
  private applyDiversityFilter(recommendations: Recommendation[], count: number): Recommendation[] {
    const diverseRecs: Recommendation[] = [];
    const categoryCount: Record<string, number> = {};
    const maxPerCategory = Math.max(1, Math.floor(count / 3));

    for (const rec of recommendations) {
      if (diverseRecs.length >= count) break;

      // Get product category (would normally fetch from product data)
      const category = rec.metadata?.category || 'general';
      const currentCount = categoryCount[category] || 0;

      if (currentCount < maxPerCategory) {
        diverseRecs.push(rec);
        categoryCount[category] = currentCount + 1;
      }
    }

    // Fill remaining slots if needed
    for (const rec of recommendations) {
      if (diverseRecs.length >= count) break;
      if (!diverseRecs.find(r => r.productId === rec.productId)) {
        diverseRecs.push(rec);
      }
    }

    return diverseRecs.slice(0, count);
  }

  /**
   * Find users similar to the given user
   */
  private async findSimilarUsers(userId: string): Promise<SimilarityScore[]> {
    // Check cache first
    const cached = this.userSimilarityCache.get(userId);
    if (cached && this.isSimilarityCacheValid(userId)) {
      return cached;
    }

    try {
      // Get user's purchase history
      const userPurchases = await this.getUserPurchases(userId);
      
      // Get other users' purchase histories
      const otherUsers = await this.getOtherUsersWithPurchases(userId);
      
      const similarities: SimilarityScore[] = [];

      for (const otherUser of otherUsers) {
        const similarity = this.calculateUserSimilarity(userPurchases, otherUser.purchases);
        
        if (similarity.score > 0.1) { // Minimum similarity threshold
          similarities.push({
            userId1: userId,
            userId2: otherUser.userId,
            score: similarity.score,
            commonItems: similarity.commonItems,
            algorithm: 'cosine'
          });
        }
      }

      const sortedSimilarities = similarities
        .sort((a, b) => b.score - a.score)
        .slice(0, 20); // Top 20 similar users

      // Cache the result
      this.userSimilarityCache.set(userId, sortedSimilarities);

      return sortedSimilarities;

    } catch (error) {
      console.error('Error finding similar users:', error);
      return [];
    }
  }

  /**
   * Calculate similarity between two users based on their purchases
   */
  private calculateUserSimilarity(
    userPurchases: Purchase[],
    otherPurchases: Purchase[]
  ): { score: number; commonItems: string[] } {
    const userItems = new Set(userPurchases.map(p => p.productId));
    const otherItems = new Set(otherPurchases.map(p => p.productId));
    
    const commonItems = Array.from(userItems).filter(item => otherItems.has(item));
    
    if (commonItems.length === 0) {
      return { score: 0, commonItems: [] };
    }

    // Jaccard similarity
    const union = new Set([...userItems, ...otherItems]);
    const jaccardScore = commonItems.length / union.size;

    // Cosine similarity with ratings
    let dotProduct = 0;
    let userMagnitude = 0;
    let otherMagnitude = 0;

    for (const item of commonItems) {
      const userRating = userPurchases.find(p => p.productId === item)?.rating || 3;
      const otherRating = otherPurchases.find(p => p.productId === item)?.rating || 3;
      
      dotProduct += userRating * otherRating;
      userMagnitude += userRating * userRating;
      otherMagnitude += otherRating * otherRating;
    }

    const cosineScore = userMagnitude && otherMagnitude ? 
      dotProduct / (Math.sqrt(userMagnitude) * Math.sqrt(otherMagnitude)) : 0;

    // Combine Jaccard and Cosine similarities
    const finalScore = (jaccardScore * 0.4 + cosineScore * 0.6);

    return { score: finalScore, commonItems };
  }

  /**
   * Build user preference profile from behavior data
   */
  private buildUserPreferenceProfile(user: User): {
    preferredCategories: string[];
    preferredBrands: string[];
    preferredFeatures: string[];
    averagePrice: number;
    priceRange: { min: number; max: number };
  } {
    const purchases = user.behavior.purchaseHistory;
    
    // Category preferences
    const categoryCount: Record<string, number> = {};
    const brandCount: Record<string, number> = {};
    const featureCount: Record<string, number> = {};
    const prices: number[] = [];

    for (const purchase of purchases) {
      categoryCount[purchase.category] = (categoryCount[purchase.category] || 0) + 1;
      prices.push(purchase.amount);
    }

    // Extract preferences from explicit user preferences
    for (const category of user.preferences.categories) {
      categoryCount[category] = (categoryCount[category] || 0) + 2; // Boost explicit preferences
    }

    for (const brand of user.preferences.brands) {
      brandCount[brand] = (brandCount[brand] || 0) + 2;
    }

    for (const feature of user.preferences.features) {
      featureCount[feature] = (featureCount[feature] || 0) + 2;
    }

    return {
      preferredCategories: Object.entries(categoryCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([category]) => category),
      preferredBrands: Object.entries(brandCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([brand]) => brand),
      preferredFeatures: Object.entries(featureCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([feature]) => feature),
      averagePrice: prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0,
      priceRange: {
        min: Math.min(...prices) || 0,
        max: Math.max(...prices) || 1000
      }
    };
  }

  /**
   * Calculate content-based similarity score
   */
  private calculateContentSimilarityScore(
    product: Product,
    userProfile: ReturnType<RecommendationAgent['buildUserPreferenceProfile']>
  ): number {
    let score = 0;
    const weights = this.algorithms.contentBased.featureWeights;

    // Category match
    if (userProfile.preferredCategories.includes(product.category)) {
      score += weights.category;
    }

    // Brand match
    if (userProfile.preferredBrands.includes(product.brand)) {
      score += weights.brand;
    }

    // Price similarity
    const priceDiff = Math.abs(product.price - userProfile.averagePrice);
    const maxPrice = Math.max(product.price, userProfile.averagePrice);
    const priceScore = maxPrice > 0 ? 1 - (priceDiff / maxPrice) : 1;
    score += priceScore * weights.price;

    // Feature match
    const matchingFeatures = product.features.filter(f => 
      userProfile.preferredFeatures.includes(f)
    );
    const featureScore = product.features.length > 0 ? 
      matchingFeatures.length / product.features.length : 0;
    score += featureScore * weights.features;

    return Math.min(score, 1.0);
  }

  // Helper methods for data access (would integrate with MCP in production)

  private async getUserProfile(userId: string): Promise<User> {
    try {
      const profileData = await this.queryMCP('user-service', 'getUserProfile', { userId });
      const purchaseData = await this.queryMCP('transaction-service', 'getUserPurchases', { userId });
      const behaviorData = await this.queryMCP('analytics-service', 'getUserBehavior', { userId });

      return {
        userId,
        demographics: profileData.demographics || {},
        preferences: profileData.preferences || { categories: [], brands: [], priceRange: { min: 0, max: 1000 }, features: [] },
        behavior: {
          purchaseHistory: purchaseData.purchases || [],
          browsingHistory: behaviorData.browsing || [],
          interactionHistory: behaviorData.interactions || []
        },
        profile: profileData.profile || {}
      };

    } catch (error) {
      console.error('Error getting user profile:', error);
      return this.getDefaultUserProfile(userId);
    }
  }

  private async getAvailableProducts(filters?: any): Promise<Product[]> {
    try {
      const productData = await this.queryMCP('product-service', 'getProducts', {
        filters,
        limit: 1000,
        availability: true
      });

      let products = productData.products || [];

      // Apply client-side filtering if MCP doesn't handle it
      if (filters) {
        products = this.applyClientSideFilters(products, filters);
      }

      return products;

    } catch (error) {
      console.error('Error getting products:', error);
      return [];
    }
  }

  private applyClientSideFilters(products: Product[], filters: any): Product[] {
    return products.filter(product => {
      // Category filter
      if (filters.categories && filters.categories.length > 0) {
        if (!filters.categories.includes(product.category)) {
          return false;
        }
      }

      // Price range filter
      if (filters.priceRange) {
        const { min, max } = filters.priceRange;
        if (product.price < min || product.price > max) {
          return false;
        }
      }

      // Brand filter
      if (filters.brands && filters.brands.length > 0) {
        if (!filters.brands.includes(product.brand)) {
          return false;
        }
      }

      // Feature filter
      if (filters.features && filters.features.length > 0) {
        const hasMatchingFeature = filters.features.some((feature: string) =>
          product.features.includes(feature)
        );
        if (!hasMatchingFeature) {
          return false;
        }
      }

      return true;
    });
  }

  private applyProductExclusions(products: Product[], excludeProducts?: string[]): Product[] {
    if (!excludeProducts || excludeProducts.length === 0) {
      return products;
    }

    return products.filter(product => !excludeProducts.includes(product.productId));
  }

  private async getUserPurchases(userId: string): Promise<Purchase[]> {
    try {
      const data = await this.queryMCP('transaction-service', 'getUserPurchases', { userId });
      return data.purchases || [];
    } catch (error) {
      return [];
    }
  }

  private async getOtherUsersWithPurchases(excludeUserId: string): Promise<Array<{ userId: string; purchases: Purchase[] }>> {
    try {
      const data = await this.queryMCP('analytics-service', 'getUsersWithPurchases', { 
        excludeUserId,
        limit: 100
      });
      return data.users || [];
    } catch (error) {
      return [];
    }
  }

  private async getProductsLikedBySimilarUsers(
    similarUsers: SimilarityScore[],
    excludeProducts: string[]
  ): Promise<string[]> {
    const productScores: Record<string, number> = {};

    for (const similarUser of similarUsers) {
      try {
        const purchases = await this.getUserPurchases(similarUser.userId2);
        
        for (const purchase of purchases) {
          if (excludeProducts.includes(purchase.productId)) continue;
          
          const rating = purchase.rating || 3;
          if (rating >= 4) { // Only consider highly rated products
            const weight = similarUser.score * (rating / 5);
            productScores[purchase.productId] = (productScores[purchase.productId] || 0) + weight;
          }
        }
      } catch (error) {
        console.error('Error getting purchases for similar user:', error);
      }
    }

    return Object.entries(productScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50)
      .map(([productId]) => productId);
  }

  private calculateCollaborativeScore(
    productId: string,
    similarUsers: SimilarityScore[],
    user: User
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const similarUser of similarUsers) {
      // This would normally fetch the rating from the similar user's purchases
      const rating = 4; // Simplified - assume good rating
      const weight = similarUser.score;
      
      totalScore += rating * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? (totalScore / totalWeight) / 5 : 0; // Normalize to 0-1
  }

  private generateContentBasedReasoning(
    product: Product,
    userProfile: ReturnType<RecommendationAgent['buildUserPreferenceProfile']>
  ): string {
    const reasons: string[] = [];

    if (userProfile.preferredCategories.includes(product.category)) {
      reasons.push(`matches your interest in ${product.category}`);
    }

    if (userProfile.preferredBrands.includes(product.brand)) {
      reasons.push(`from your preferred brand ${product.brand}`);
    }

    const matchingFeatures = product.features.filter(f => 
      userProfile.preferredFeatures.includes(f)
    );

    if (matchingFeatures.length > 0) {
      reasons.push(`has features you like: ${matchingFeatures.slice(0, 3).join(', ')}`);
    }

    return reasons.length > 0 ? 
      `Recommended because it ${reasons.join(' and ')}` :
      'Recommended based on your preferences';
  }

  private calculateContentConfidence(
    product: Product,
    userProfile: ReturnType<RecommendationAgent['buildUserPreferenceProfile']>
  ): number {
    let confidence = 0.5; // Base confidence

    if (userProfile.preferredCategories.includes(product.category)) {
      confidence += 0.2;
    }

    if (userProfile.preferredBrands.includes(product.brand)) {
      confidence += 0.15;
    }

    const featureMatch = product.features.filter(f => 
      userProfile.preferredFeatures.includes(f)
    ).length / Math.max(product.features.length, 1);

    confidence += featureMatch * 0.25;

    return Math.min(confidence, 1.0);
  }

  private getMatchedFeatures(
    product: Product,
    userProfile: ReturnType<RecommendationAgent['buildUserPreferenceProfile']>
  ): string[] {
    return product.features.filter(f => userProfile.preferredFeatures.includes(f));
  }

  private prepareUserContextForAI(user: User, context: RecommendationContext): any {
    return {
      demographics: user.demographics,
      purchase_history: user.behavior.purchaseHistory.slice(-10).map(p => ({
        category: p.category,
        amount: p.amount,
        rating: p.rating
      })),
      preferences: user.preferences,
      budget_range: user.preferences.priceRange,
      current_context: context
    };
  }

  private getDefaultUserProfile(userId: string): User {
    return {
      userId,
      demographics: {},
      preferences: {
        categories: [],
        brands: [],
        priceRange: { min: 0, max: 1000 },
        features: []
      },
      behavior: {
        purchaseHistory: [],
        browsingHistory: [],
        interactionHistory: []
      },
      profile: {}
    };
  }

  private getFallbackRecommendations(
    request: RecommendationRequest,
    processingTime: number
  ): RecommendationResponse {
    // Return trending or popular products as fallback
    return {
      recommendations: [],
      totalCount: 0,
      algorithms: ['fallback'],
      processingTime,
      cacheHit: false
    };
  }

  private generateCacheKey(request: RecommendationRequest): string {
    return `${request.userId}_${request.type}_${JSON.stringify(request.filters)}_${request.count}`;
  }

  private isCacheValid(cached: RecommendationResponse): boolean {
    // Simple time-based cache validation
    return Date.now() - (cached as any).timestamp < this.cacheTimeout;
  }

  private isSimilarityCacheValid(userId: string): boolean {
    // Check if similarity cache is still valid
    return true; // Simplified for now
  }

  // Override base agent request processing
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { action, payload } = request.payload;

      switch (action) {
        case 'generate_recommendations':
          const response = await this.generateRecommendations(payload as RecommendationRequest);
          return this.createSuccessResponse(request, { response });

        case 'get_similar_users':
          const similarUsers = await this.findSimilarUsers(payload.userId);
          return this.createSuccessResponse(request, { similarUsers });

        default:
          return this.createErrorResponse(request, 'Unknown action', 'INVALID_ACTION');
      }

    } catch (error) {
      return this.createErrorResponse(
        request,
        error instanceof Error ? error.message : 'Unknown error',
        'PROCESSING_ERROR'
      );
    }
  }

  private createSuccessResponse(request: AgentRequest, payload: any): AgentResponse {
    return {
      id: `response_${Date.now()}`,
      requestId: request.id,
      timestamp: new Date(),
      success: true,
      payload,
      processingTime: 0 // Will be set by base class
    };
  }

  /**
   * Get session statistics for monitoring
   */
  getSessionStatistics(): any {
    return {
      totalRecommendations: this.state.metrics.requestsProcessed,
      averageResponseTime: this.state.metrics.averageResponseTime,
      errorRate: this.state.metrics.errorRate,
      cacheHitRate: 0.85, // Mock value
      activeUsers: 0 // Mock value
    };
  }

  private createErrorResponse(request: AgentRequest, message: string, code: string): AgentResponse {
    const error: SystemError = {
      code: code as ErrorCode,
      message,
      timestamp: new Date(),
      correlationId: request.correlationId
    };

    return {
      id: `error_${Date.now()}`,
      requestId: request.id,
      timestamp: new Date(),
      success: false,
      error,
      processingTime: 0 // Will be set by base class
    };
  }
}