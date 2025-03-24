module a3::creator_profile {
    use std::string::{String};
    use std::signer;
    use std::error;
    use aptos_framework::event;
    use aptos_framework::account;
    use a3::types::{SocialLinks};
    
    /// Errors
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_PROFILE_NOT_FOUND: u64 = 2;
    const E_PROFILE_ALREADY_EXISTS: u64 = 3;

    /// Creator profile
    struct CreatorProfile has key, store {
        name: String,
        description: String,
        wallet_address: address,
        social_links: SocialLinks,
        registration_time: u64,
        last_updated: u64,
    }
    
    /// Resource to store creator profiles by their ID
    struct CreatorProfileStore has key {
        profiles: vector<CreatorProfile>,
    }
    
    /// Events
    struct ProfileCreatedEvent has drop, store {
        creator_address: address,
        name: String,
        timestamp: u64,
    }
    
    struct ProfileUpdatedEvent has drop, store {
        creator_address: address,
        name: String,
        timestamp: u64,
    }
    
    /// Initialize module with empty profile store
    public entry fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);
        if (!exists<CreatorProfileStore>(account_addr)) {
            move_to(account, CreatorProfileStore {
                profiles: vector::empty<CreatorProfile>(),
            });
        };
    }
    
    /// Create a new creator profile
    public entry fun create_profile(
        account: &signer,
        name: String,
        description: String,
        social_twitter: String,
        social_discord: String,
        social_telegram: String,
        social_website: String
    ) {
        let account_addr = signer::address_of(account);
        
        // Check if profile already exists
        assert!(!has_profile(account_addr), error::already_exists(E_PROFILE_ALREADY_EXISTS));
        
        // Create social links
        let social_links = a3::types::create_social_links(
            social_twitter,
            social_discord,
            social_telegram,
            social_website
        );
        
        // Create and store the profile
        let current_time = aptos_framework::timestamp::now_seconds();
        let new_profile = CreatorProfile {
            name,
            description,
            wallet_address: account_addr,
            social_links,
            registration_time: current_time,
            last_updated: current_time,
        };
        
        // Add profile to store
        if (!exists<CreatorProfileStore>(account_addr)) {
            move_to(account, CreatorProfileStore {
                profiles: vector::singleton(new_profile),
            });
        } else {
            let store = borrow_global_mut<CreatorProfileStore>(account_addr);
            vector::push_back(&mut store.profiles, new_profile);
        };
        
        // Emit event
        event::emit(ProfileCreatedEvent {
            creator_address: account_addr,
            name,
            timestamp: current_time,
        });
    }
    
    /// Update an existing creator profile
    public entry fun update_profile(
        account: &signer,
        name: String,
        description: String,
        social_twitter: String,
        social_discord: String,
        social_telegram: String,
        social_website: String
    ) {
        let account_addr = signer::address_of(account);
        
        // Check if profile exists
        assert!(has_profile(account_addr), error::not_found(E_PROFILE_NOT_FOUND));
        
        // Get profile
        let store = borrow_global_mut<CreatorProfileStore>(account_addr);
        let profile_idx = find_profile_index(&store.profiles, account_addr);
        assert!(profile_idx < vector::length(&store.profiles), error::not_found(E_PROFILE_NOT_FOUND));
        
        let profile = vector::borrow_mut(&mut store.profiles, profile_idx);
        
        // Update profile
        profile.name = name;
        profile.description = description;
        profile.social_links = a3::types::create_social_links(
            social_twitter,
            social_discord,
            social_telegram,
            social_website
        );
        profile.last_updated = aptos_framework::timestamp::now_seconds();
        
        // Emit event
        event::emit(ProfileUpdatedEvent {
            creator_address: account_addr,
            name,
            timestamp: profile.last_updated,
        });
    }
    
    /// Check if an address has a creator profile
    public fun has_profile(addr: address): bool {
        exists<CreatorProfileStore>(addr) && 
        find_profile_index(&borrow_global<CreatorProfileStore>(addr).profiles, addr) < 
        vector::length(&borrow_global<CreatorProfileStore>(addr).profiles)
    }
    
    /// Get creator profile (read-only)
    public fun get_profile(addr: address): (String, String, address, SocialLinks, u64, u64) {
        assert!(has_profile(addr), error::not_found(E_PROFILE_NOT_FOUND));
        
        let store = borrow_global<CreatorProfileStore>(addr);
        let profile_idx = find_profile_index(&store.profiles, addr);
        let profile = vector::borrow(&store.profiles, profile_idx);
        
        (
            profile.name,
            profile.description,
            profile.wallet_address,
            profile.social_links,
            profile.registration_time,
            profile.last_updated
        )
    }
    
    /// Helper function to find profile index in the vector
    fun find_profile_index(profiles: &vector<CreatorProfile>, addr: address): u64 {
        let i = 0;
        let len = vector::length(profiles);
        
        while (i < len) {
            let profile = vector::borrow(profiles, i);
            if (profile.wallet_address == addr) {
                return i
            };
            i = i + 1;
        };
        
        len // Return length if not found (will be handled as not found)
    }
} 