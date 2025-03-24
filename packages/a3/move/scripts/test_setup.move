script {
    use std::string;
    use std::vector;
    use std::signer;
    use a3::a3_manager;
    use a3::creator_profile;
    use a3::process_registry;
    use a3::workflow;
    use a3::queue;
    
    /// Create a test environment for the A3 system 
    public entry fun test_setup(
        admin: &signer,
        creator: &signer,
        user: &signer
    ) {
        let admin_addr = signer::address_of(admin);
        let creator_addr = signer::address_of(creator);
        
        // Initialize the system
        a3_manager::initialize(admin, 100, admin_addr); // 1% fee to admin
        
        // Create a creator profile
        let name_str = string::utf8(b"Test Creator");
        let description_str = string::utf8(b"A test creator for the A3 system");
        let social_links = vector::empty<string::String>();
        
        creator_profile::create_profile(
            creator,
            name_str,
            description_str,
            creator_addr,
            social_links
        );
        
        // Register a process
        let process_id_str = string::utf8(b"process_1");
        let name_str = string::utf8(b"Test Process");
        let description_str = string::utf8(b"A test process for the A3 system");
        
        let tags_str = vector::empty<string::String>();
        vector::push_back(&mut tags_str, string::utf8(b"test"));
        vector::push_back(&mut tags_str, string::utf8(b"demo"));
        
        process_registry::register_process(
            creator,
            process_id_str,
            name_str,
            description_str,
            vector::empty(), // No agents initially
            vector::empty(), // No workflows initially
            tags_str
        );
        
        // Create a workflow
        let workflow_id_str = string::utf8(b"workflow_1");
        let name_str = string::utf8(b"Test Workflow");
        let description_str = string::utf8(b"A test workflow for the process");
        
        workflow::create_workflow(
            creator,
            workflow_id_str,
            name_str,
            description_str
        );
        
        // Add workflow to process
        process_registry::add_workflow(
            creator,
            process_id_str,
            workflow_id_str
        );
        
        // Add a task to the workflow
        workflow::add_task(
            creator,
            workflow_id_str,
            string::utf8(b"task_1"),
            string::utf8(b"Test Task"),
            string::utf8(b"A test task for the workflow"),
            creator_addr,
            vector::empty() // No dependencies
        );
        
        // Initialize a queue for the creator
        queue::initialize_queue(
            creator,
            string::utf8(b"Creator Queue"),
            5
        );
        
        // User submits a transaction to the queue
        queue::submit_transaction(
            user,
            process_id_str,
            string::utf8(b"tx_1"),
            option::some(workflow_id_str),
            option::some(string::utf8(b"task_1")),
            1, // normal priority
            vector[0, 1, 2, 3] // sample data
        );
    }
} 