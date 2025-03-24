module a3::types {
    use std::string::{String};
    use std::vector;
    
    /// Status of a process
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_INACTIVE: u8 = 2;
    const STATUS_ERROR: u8 = 3;
    
    /// Errors
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_PROCESS_NOT_FOUND: u64 = 2;
    const E_PROCESS_ALREADY_EXISTS: u64 = 3;
    const E_PROFILE_NOT_FOUND: u64 = 4;
    const E_INVALID_PAYMENT: u64 = 5;
    const E_PAYMENT_REQUIRED: u64 = 6;
    
    /// Basic agent metadata
    struct Agent has store, drop, copy {
        id: String,
        name: String,
        instructions: String,
        goal: String,
        role: String,
    }
    
    /// Workflow metadata
    struct Workflow has store, drop, copy {
        id: String,
        name: String,
        description: String,
    }
    
    /// Social media links for creator profiles
    struct SocialLinks has store, drop, copy {
        twitter: String,
        discord: String,
        telegram: String,
        website: String,
        // Additional fields can be added as needed
    }
    
    /// Process pricing information
    struct Pricing has store, drop, copy {
        task_price: u64,  // In smallest unit of currency (e.g., octas for APT)
        currency: String, // Token type
        payment_address: address,
        requires_prepayment: bool,
    }
    
    /// Function to create a simple agent
    public fun create_agent(
        id: String,
        name: String,
        instructions: String,
        goal: String,
        role: String
    ): Agent {
        Agent {
            id,
            name,
            instructions,
            goal,
            role,
        }
    }
    
    /// Function to create a simple workflow
    public fun create_workflow(
        id: String,
        name: String,
        description: String
    ): Workflow {
        Workflow {
            id,
            name,
            description,
        }
    }
    
    /// Function to create social links
    public fun create_social_links(
        twitter: String,
        discord: String,
        telegram: String,
        website: String
    ): SocialLinks {
        SocialLinks {
            twitter,
            discord,
            telegram,
            website,
        }
    }
    
    /// Function to create pricing information
    public fun create_pricing(
        task_price: u64,
        currency: String,
        payment_address: address,
        requires_prepayment: bool
    ): Pricing {
        Pricing {
            task_price,
            currency,
            payment_address,
            requires_prepayment,
        }
    }
    
    /// Helper function to check if a vector contains a string
    public fun vector_contains(v: &vector<String>, item: &String): bool {
        let len = vector::length(v);
        let i = 0;
        while (i < len) {
            if (vector::borrow(v, i) == item) {
                return true
            };
            i = i + 1;
        };
        false
    }
} 