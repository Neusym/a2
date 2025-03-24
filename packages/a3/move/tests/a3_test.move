#[test_only]
module a3::a3_test {
    use std::string::{String};
    use std::signer;
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use a3::a3_manager;
    use a3::creator_profile;
    use a3::process_registry;
    use a3::payment;
    use a3::workflow;
    use a3::queue;
    
    /// Test account addresses
    const ADMIN_ADDR: address = @0xA1;
    const CREATOR_ADDR: address = @0xA2;
    const USER_ADDR: address = @0xA3;
    
    /// Initialize test environment
    fun setup_test(
        aptos_framework: &signer,
        a3: &signer,
        admin: &signer,
        creator: &signer,
        user: &signer
    ) {
        // Initialize the Aptos framework for testing
        timestamp::set_time_has_started_for_testing(aptos_framework);
        
        // Create test accounts
        account::create_account_for_test(signer::address_of(admin));
        account::create_account_for_test(signer::address_of(creator));
        account::create_account_for_test(signer::address_of(user));
        account::create_account_for_test(signer::address_of(a3));
        
        // Initialize A3 system
        a3_manager::initialize(a3, 100, signer::address_of(admin)); // 1% fee
    }
    
    #[test(aptos_framework = @aptos_framework, a3 = @a3, admin = @0xA1, creator = @0xA2, user = @0xA3)]
    public entry fun test_creator_profile(
        aptos_framework: &signer,
        a3: &signer,
        admin: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup_test(aptos_framework, a3, admin, creator, user);
        
        // Create a creator profile
        creator_profile::create_profile(
            creator,
            String::utf8(b"Test Creator"),
            String::utf8(b"A test creator for the A3 system"),
            signer::address_of(creator),
            vector::empty<String>()
        );
        
        // Verify profile exists
        assert!(creator_profile::profile_exists(signer::address_of(creator)), 0);
        
        // Get profile details and verify
        let (name, description, wallet, _, _) = creator_profile::get_profile(signer::address_of(creator));
        assert!(name == String::utf8(b"Test Creator"), 1);
        assert!(description == String::utf8(b"A test creator for the A3 system"), 2);
        assert!(wallet == signer::address_of(creator), 3);
    }
    
    #[test(aptos_framework = @aptos_framework, a3 = @a3, admin = @0xA1, creator = @0xA2, user = @0xA3)]
    public entry fun test_process_registry(
        aptos_framework: &signer,
        a3: &signer,
        admin: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup_test(aptos_framework, a3, admin, creator, user);
        
        // Register a process
        let process_id = String::utf8(b"process_1");
        process_registry::register_process(
            creator,
            process_id,
            String::utf8(b"Test Process"),
            String::utf8(b"A test process for the A3 system"),
            vector::empty<address>(), // No agents
            vector::empty<String>(), // No workflows
            vector[String::utf8(b"test"), String::utf8(b"demo")] // Tags
        );
        
        // Verify process exists
        assert!(process_registry::process_exists(process_id), 0);
        
        // Get process details and verify
        let (id, name, owner, _, _, _, tags, _, _, _) = process_registry::get_process(process_id);
        assert!(id == process_id, 1);
        assert!(name == String::utf8(b"Test Process"), 2);
        assert!(owner == signer::address_of(creator), 3);
        assert!(vector::length(&tags) == 2, 4);
        assert!(*vector::borrow(&tags, 0) == String::utf8(b"test"), 5);
        assert!(*vector::borrow(&tags, 1) == String::utf8(b"demo"), 6);
    }
    
    #[test(aptos_framework = @aptos_framework, a3 = @a3, admin = @0xA1, creator = @0xA2, user = @0xA3)]
    public entry fun test_workflow(
        aptos_framework: &signer,
        a3: &signer,
        admin: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup_test(aptos_framework, a3, admin, creator, user);
        
        // Create a workflow
        let workflow_id = String::utf8(b"workflow_1");
        workflow::create_workflow(
            creator,
            workflow_id,
            String::utf8(b"Test Workflow"),
            String::utf8(b"A test workflow")
        );
        
        // Verify workflow exists
        assert!(workflow::workflow_exists(workflow_id), 0);
        
        // Get workflow details and verify
        let (id, name, description, owner, status, _, _) = workflow::get_workflow(workflow_id);
        assert!(id == workflow_id, 1);
        assert!(name == String::utf8(b"Test Workflow"), 2);
        assert!(description == String::utf8(b"A test workflow"), 3);
        assert!(owner == signer::address_of(creator), 4);
        assert!(status == 0, 5); // Draft status
        
        // Add a task
        workflow::add_task(
            creator,
            workflow_id,
            String::utf8(b"task_1"),
            String::utf8(b"Test Task"),
            String::utf8(b"A test task"),
            signer::address_of(user), // Assignee
            vector::empty<String>() // No dependencies
        );
        
        // Verify task count
        assert!(workflow::get_workflow_task_count(workflow_id) == 1, 6);
    }
    
    #[test(aptos_framework = @aptos_framework, a3 = @a3, admin = @0xA1, creator = @0xA2, user = @0xA3)]
    #[expected_failure(abort_code = 5)] // E_PAYMENT_NOT_REQUIRED
    public entry fun test_payment_failure(
        aptos_framework: &signer,
        a3: &signer,
        admin: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup_test(aptos_framework, a3, admin, creator, user);
        
        // Register a process without pricing
        let process_id = String::utf8(b"process_1");
        process_registry::register_process(
            creator,
            process_id,
            String::utf8(b"Test Process"),
            String::utf8(b"A test process for the A3 system"),
            vector::empty<address>(), // No agents
            vector::empty<String>(), // No workflows
            vector[String::utf8(b"test")] // Tags
        );
        
        // Try to make payment for a process that doesn't require payment
        // This should fail with E_PAYMENT_NOT_REQUIRED
        payment::make_payment(
            user,
            process_id,
            1000000 // 1 APT
        );
    }
    
    #[test(aptos_framework = @aptos_framework, a3 = @a3, admin = @0xA1, creator = @0xA2, user = @0xA3)]
    public entry fun test_queue(
        aptos_framework: &signer,
        a3: &signer,
        admin: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup_test(aptos_framework, a3, admin, creator, user);
        
        // Initialize a queue
        queue::initialize_queue(
            creator,
            String::utf8(b"Test Queue"),
            5 // Processing limit
        );
        
        // Register a process
        let process_id = String::utf8(b"process_1");
        process_registry::register_process(
            creator,
            process_id,
            String::utf8(b"Test Process"),
            String::utf8(b"A test process for the A3 system"),
            vector::empty<address>(), // No agents
            vector::empty<String>(), // No workflows
            vector[String::utf8(b"test")] // Tags
        );
        
        // Submit a transaction
        queue::submit_transaction(
            user,
            process_id,
            String::utf8(b"tx_1"),
            option::none<String>(), // No workflow
            option::none<String>(), // No task
            1, // Normal priority
            vector[0, 1, 2, 3] // Sample data
        );
        
        // Verify queue size
        assert!(queue::get_queue_size(signer::address_of(creator)) == 1, 0);
        
        // Verify pending transaction count
        assert!(queue::get_pending_transaction_count(signer::address_of(creator)) == 1, 1);
    }
    
    #[test(aptos_framework = @aptos_framework, a3 = @a3, admin = @0xA1, creator = @0xA2, user = @0xA3)]
    public entry fun test_a3_manager(
        aptos_framework: &signer,
        a3: &signer,
        admin: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup_test(aptos_framework, a3, admin, creator, user);
        
        // Get protocol fee info
        let (fee_percentage, fee_recipient) = a3_manager::get_protocol_fee_info();
        assert!(fee_percentage == 100, 0); // 1%
        assert!(fee_recipient == signer::address_of(admin), 1);
        
        // Update protocol fee
        a3_manager::update_protocol_fee(
            a3, // Only admin can update
            200, // 2%
            signer::address_of(creator) // New recipient
        );
        
        // Verify updated fee info
        let (fee_percentage, fee_recipient) = a3_manager::get_protocol_fee_info();
        assert!(fee_percentage == 200, 2); // 2%
        assert!(fee_recipient == signer::address_of(creator), 3);
        
        // Register creator and process in one step
        a3_manager::register_creator_and_process(
            user,
            String::utf8(b"Test User"),
            String::utf8(b"A test user"),
            vector::empty<String>(), // No social links
            String::utf8(b"user_process"),
            String::utf8(b"User Process"),
            String::utf8(b"A process created by user"),
            vector[String::utf8(b"user"), String::utf8(b"test")]
        );
        
        // Verify creator profile exists
        assert!(creator_profile::profile_exists(signer::address_of(user)), 4);
        
        // Verify process exists
        assert!(process_registry::process_exists(String::utf8(b"user_process")), 5);
    }
} 