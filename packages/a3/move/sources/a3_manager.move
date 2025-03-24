module a3::a3_manager {
    use std::string::{String};
    use std::signer;
    use std::error;
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use a3::creator_profile;
    use a3::process_registry;
    use a3::payment;
    use a3::workflow;
    use a3::queue;
    
    /// Errors
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;
    const E_ALREADY_INITIALIZED: u64 = 3;
    
    /// Configuration for the A3 system
    struct A3Config has key {
        admin: address,
        protocol_fee_percentage: u64, // in basis points (1% = 100)
        protocol_fee_recipient: address,
        initialized_at: u64,
        updated_at: u64,
    }
    
    /// Initialize the A3 system
    public entry fun initialize(
        account: &signer,
        protocol_fee_percentage: u64,
        protocol_fee_recipient: address
    ) {
        let account_addr = signer::address_of(account);
        
        // Only the module publisher can initialize
        assert!(account_addr == @a3, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Check if already initialized
        assert!(!exists<A3Config>(account_addr), error::already_exists(E_ALREADY_INITIALIZED));
        
        let current_time = timestamp::now_seconds();
        
        // Create config
        let config = A3Config {
            admin: account_addr,
            protocol_fee_percentage,
            protocol_fee_recipient,
            initialized_at: current_time,
            updated_at: current_time,
        };
        
        // Store config
        move_to(account, config);
        
        // Initialize all sub-modules
        creator_profile::initialize(account);
        process_registry::initialize(account);
        payment::initialize(account);
        workflow::initialize(account);
        queue::initialize_queue(account, String::utf8(b"Main Queue"), 10);
    }
    
    /// Update protocol fee settings
    public entry fun update_protocol_fee(
        account: &signer,
        new_fee_percentage: u64,
        new_fee_recipient: address
    ) {
        let account_addr = signer::address_of(account);
        
        // Check if initialized
        assert!(exists<A3Config>(@a3), error::not_found(E_NOT_INITIALIZED));
        
        // Get config
        let config = borrow_global_mut<A3Config>(@a3);
        
        // Check authorization
        assert!(account_addr == config.admin, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Update fee settings
        config.protocol_fee_percentage = new_fee_percentage;
        config.protocol_fee_recipient = new_fee_recipient;
        config.updated_at = timestamp::now_seconds();
    }
    
    /// Transfer admin rights
    public entry fun transfer_admin(
        account: &signer,
        new_admin: address
    ) {
        let account_addr = signer::address_of(account);
        
        // Check if initialized
        assert!(exists<A3Config>(@a3), error::not_found(E_NOT_INITIALIZED));
        
        // Get config
        let config = borrow_global_mut<A3Config>(@a3);
        
        // Check authorization
        assert!(account_addr == config.admin, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Update admin
        config.admin = new_admin;
        config.updated_at = timestamp::now_seconds();
    }
    
    /// Register as a creator and register a process in one transaction
    public entry fun register_creator_and_process(
        account: &signer,
        creator_name: String,
        creator_description: String,
        social_links: vector<String>,
        process_id: String,
        process_name: String,
        process_description: String,
        tags: vector<String>
    ) {
        let sender_addr = signer::address_of(account);
        
        // Register creator profile if doesn't exist
        if (!creator_profile::profile_exists(sender_addr)) {
            creator_profile::create_profile(
                account,
                creator_name,
                creator_description,
                sender_addr,
                social_links
            );
        };
        
        // Register process
        process_registry::register_process(
            account,
            process_id,
            process_name,
            process_description,
            vector::empty(), // No agents initially
            vector::empty(), // No workflows initially
            tags
        );
    }
    
    /// Create a process workflow
    public entry fun create_process_workflow(
        account: &signer,
        process_id: String,
        workflow_id: String,
        workflow_name: String,
        workflow_description: String
    ) {
        // Check if process exists and user is owner
        assert!(process_registry::process_exists(process_id), error::not_found(E_NOT_INITIALIZED));
        let (_, _, process_owner, _, _, _, _, _, _, _) = process_registry::get_process(process_id);
        assert!(process_owner == signer::address_of(account), error::permission_denied(E_NOT_AUTHORIZED));
        
        // Create workflow
        workflow::create_workflow(
            account,
            workflow_id,
            workflow_name,
            workflow_description
        );
        
        // Add workflow to process
        process_registry::add_workflow(account, process_id, workflow_id);
    }
    
    /// Execute a process with payment
    public entry fun execute_process_with_payment(
        account: &signer,
        process_id: String,
        transaction_id: String,
        amount: u64,
        priority: u8,
        data: vector<u8>
    ) {
        // Make payment first
        payment::make_payment(account, process_id, amount);
        
        // Submit transaction to queue
        queue::submit_transaction(
            account,
            process_id,
            transaction_id,
            option::none(), // No specific workflow
            option::none(), // No specific task
            priority,
            data
        );
    }
    
    /// Get protocol fee information
    public fun get_protocol_fee_info(): (u64, address) {
        assert!(exists<A3Config>(@a3), error::not_found(E_NOT_INITIALIZED));
        
        let config = borrow_global<A3Config>(@a3);
        (config.protocol_fee_percentage, config.protocol_fee_recipient)
    }
} 