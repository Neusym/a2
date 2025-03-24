/**
 * Social media links for a creator profile
 */
export interface SocialLinks {
  [platform: string]: string;
}

/**
 * Creator profile information
 */
export interface CreatorProfile {
  /** Creator's name */
  name?: string;
  
  /** Description of the creator */
  description?: string;
  
  /** Wallet address for the creator */
  walletAddress?: string;
  
  /** Creator's website URL */
  website?: string;
  
  /** Social media links */
  social?: SocialLinks;
}

/**
 * Creator service interface for managing creator profiles
 */
export interface CreatorService {
  /**
   * Register a new creator profile
   * 
   * @param profile Creator profile information
   * @returns Promise resolving to the creator ID
   */
  registerCreator(profile: CreatorProfile): Promise<string>;
  
  /**
   * Get a creator profile by ID
   * 
   * @param creatorId Creator identifier
   * @returns Promise resolving to the creator profile or null if not found
   */
  getCreator(creatorId: string): Promise<CreatorProfile | null>;
  
  /**
   * Update an existing creator profile
   * 
   * @param creatorId Creator identifier
   * @param profile Updated creator profile information
   */
  updateCreator(creatorId: string, profile: Partial<CreatorProfile>): Promise<void>;
} 