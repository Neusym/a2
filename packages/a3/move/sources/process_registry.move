module a3::process_registry {
    use std::string::{String};
    use std::vector;
    use std::signer;
    use std::error;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use a3::types::{Agent, Workflow, Pricing};
    use a3::creator_profile;
    
    /// Errors
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_PROCESS_NOT_FOUND: u64 = 2;
    const E_PROCESS_ALREADY_EXISTS: u64 = 3;
    
    /// Process status enum
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_INACTIVE: u8 = 2;
    const STATUS_ERROR: u8 = 3;
    
    /// Process metadata
    struct Process has key, store {
        id: String,
        name: String,
        description: String,
        owner: address,
        agents: vector<Agent>,
        workflows: vector<Workflow>,
        tags: vector<String>,
        status: u8,
        pricing: Option<Pricing>,
        created_at: u64,
        updated_at: u64,
    }
    
    /// Resource to store all processes
    struct ProcessRegistry has key {
        processes: vector<Process>,
    }
    
    /// Events
    struct ProcessRegisteredEvent has drop, store {
        process_id: String,
        owner: address,
        timestamp: u64,
    }
    
    struct ProcessUpdatedEvent has drop, store {
        process_id: String,
        owner: address,
        timestamp: u64,
    }
    
    struct ProcessDeregisteredEvent has drop, store {
        process_id: String,
        owner: address,
        timestamp: u64,
    }
    
    /// Initialize module
    public entry fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);
        if (!exists<ProcessRegistry>(account_addr)) {
            move_to(account, ProcessRegistry {
                processes: vector::empty<Process>(),
            });
        };
    }
    
    /// Register a new process
    public entry fun register_process(
        account: &signer,
        id: String,
        name: String,
        description: String,
        tags: vector<String>,
        has_pricing: bool,
        task_price: u64,
        currency: String,
        requires_prepayment: bool
    ) {
        let account_addr = signer::address_of(account);
        
        // Verify creator has a profile
        assert!(creator_profile::has_profile(account_addr), error::not_found(E_NOT_AUTHORIZED));
        
        // Check process doesn't already exist
        assert!(!process_exists(id), error::already_exists(E_PROCESS_ALREADY_EXISTS));
        
        // Create process
        let current_time = timestamp::now_seconds();
        
        // Create pricing if requested
        let pricing = if (has_pricing) {
            option::some(a3::types::create_pricing(
                task_price,
                currency,
                account_addr, // Payment address is the owner's address
                requires_prepayment
            ))
        } else {
            option::none<Pricing>()
        };
        
        let process = Process {
            id,
            name,
            description,
            owner: account_addr,
            agents: vector::empty<Agent>(),
            workflows: vector::empty<Workflow>(),
            tags,
            status: STATUS_ACTIVE,
            pricing,
            created_at: current_time,
            updated_at: current_time,
        };
        
        // Get registry and add process
        let registry = borrow_global_mut<ProcessRegistry>(@a3);
        vector::push_back(&mut registry.processes, process);
        
        // Emit event
        event::emit(ProcessRegisteredEvent {
            process_id: id,
            owner: account_addr,
            timestamp: current_time,
        });
    }
    
    /// Update an existing process
    public entry fun update_process(
        account: &signer,
        id: String,
        name: String,
        description: String,
        tags: vector<String>,
        status: u8,
        has_pricing: bool,
        task_price: u64,
        currency: String,
        requires_prepayment: bool
    ) {
        let account_addr = signer::address_of(account);
        
        // Check process exists
        assert!(process_exists(id), error::not_found(E_PROCESS_NOT_FOUND));
        
        // Get registry
        let registry = borrow_global_mut<ProcessRegistry>(@a3);
        
        // Find process
        let process_idx = find_process_index(&registry.processes, &id);
        let process = vector::borrow_mut(&mut registry.processes, process_idx);
        
        // Check ownership
        assert!(process.owner == account_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Update process
        process.name = name;
        process.description = description;
        process.tags = tags;
        process.status = status;
        
        // Update pricing
        if (has_pricing) {
            process.pricing = option::some(a3::types::create_pricing(
                task_price,
                currency,
                account_addr, // Payment address is the owner's address
                requires_prepayment
            ));
        } else {
            process.pricing = option::none<Pricing>();
        };
        
        process.updated_at = timestamp::now_seconds();
        
        // Emit event
        event::emit(ProcessUpdatedEvent {
            process_id: id,
            owner: account_addr,
            timestamp: process.updated_at,
        });
    }
    
    /// Add an agent to a process
    public entry fun add_agent(
        account: &signer,
        process_id: String,
        agent_id: String,
        agent_name: String,
        instructions: String,
        goal: String,
        role: String
    ) {
        let account_addr = signer::address_of(account);
        
        // Check process exists
        assert!(process_exists(process_id), error::not_found(E_PROCESS_NOT_FOUND));
        
        // Get registry
        let registry = borrow_global_mut<ProcessRegistry>(@a3);
        
        // Find process
        let process_idx = find_process_index(&registry.processes, &process_id);
        let process = vector::borrow_mut(&mut registry.processes, process_idx);
        
        // Check ownership
        assert!(process.owner == account_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Create and add agent
        let agent = a3::types::create_agent(agent_id, agent_name, instructions, goal, role);
        vector::push_back(&mut process.agents, agent);
        
        // Update timestamp
        process.updated_at = timestamp::now_seconds();
    }
    
    /// Add a workflow to a process
    public entry fun add_workflow(
        account: &signer,
        process_id: String,
        workflow_id: String,
        workflow_name: String,
        workflow_description: String
    ) {
        let account_addr = signer::address_of(account);
        
        // Check process exists
        assert!(process_exists(process_id), error::not_found(E_PROCESS_NOT_FOUND));
        
        // Get registry
        let registry = borrow_global_mut<ProcessRegistry>(@a3);
        
        // Find process
        let process_idx = find_process_index(&registry.processes, &process_id);
        let process = vector::borrow_mut(&mut registry.processes, process_idx);
        
        // Check ownership
        assert!(process.owner == account_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Create and add workflow
        let workflow = a3::types::create_workflow(
            workflow_id, 
            workflow_name, 
            workflow_description
        );
        vector::push_back(&mut process.workflows, workflow);
        
        // Update timestamp
        process.updated_at = timestamp::now_seconds();
    }
    
    /// Deregister an existing process
    public entry fun deregister_process(account: &signer, id: String) {
        let account_addr = signer::address_of(account);
        
        // Check process exists
        assert!(process_exists(id), error::not_found(E_PROCESS_NOT_FOUND));
        
        // Get registry
        let registry = borrow_global_mut<ProcessRegistry>(@a3);
        
        // Find process
        let process_idx = find_process_index(&registry.processes, &id);
        let process = vector::borrow(&registry.processes, process_idx);
        
        // Check ownership
        assert!(process.owner == account_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Remove process
        let _removed_process = vector::remove(&mut registry.processes, process_idx);
        
        // Emit event
        event::emit(ProcessDeregisteredEvent {
            process_id: id,
            owner: account_addr,
            timestamp: timestamp::now_seconds(),
        });
    }
    
    /// Check if a process exists
    public fun process_exists(id: String): bool {
        if (!exists<ProcessRegistry>(@a3)) {
            return false
        };
        
        let registry = borrow_global<ProcessRegistry>(@a3);
        find_process_index(&registry.processes, &id) < vector::length(&registry.processes)
    }
    
    /// Get process details
    public fun get_process(id: String): (
        String, String, address, vector<Agent>, vector<Workflow>, 
        vector<String>, u8, Option<Pricing>, u64, u64
    ) {
        assert!(process_exists(id), error::not_found(E_PROCESS_NOT_FOUND));
        
        let registry = borrow_global<ProcessRegistry>(@a3);
        let process_idx = find_process_index(&registry.processes, &id);
        let process = vector::borrow(&registry.processes, process_idx);
        
        (
            process.id,
            process.name,
            process.owner,
            process.agents,
            process.workflows,
            process.tags,
            process.status,
            process.pricing,
            process.created_at,
            process.updated_at
        )
    }
    
    /// List processes owned by a specific address
    public fun list_processes_by_owner(owner: address): vector<String> {
        if (!exists<ProcessRegistry>(@a3)) {
            return vector::empty<String>()
        };
        
        let registry = borrow_global<ProcessRegistry>(@a3);
        let result = vector::empty<String>();
        
        let i = 0;
        let len = vector::length(&registry.processes);
        
        while (i < len) {
            let process = vector::borrow(&registry.processes, i);
            if (process.owner == owner) {
                vector::push_back(&mut result, process.id);
            };
            i = i + 1;
        };
        
        result
    }
    
    /// List processes by tag
    public fun list_processes_by_tag(tag: String): vector<String> {
        if (!exists<ProcessRegistry>(@a3)) {
            return vector::empty<String>()
        };
        
        let registry = borrow_global<ProcessRegistry>(@a3);
        let result = vector::empty<String>();
        
        let i = 0;
        let len = vector::length(&registry.processes);
        
        while (i < len) {
            let process = vector::borrow(&registry.processes, i);
            if (a3::types::vector_contains(&process.tags, &tag)) {
                vector::push_back(&mut result, process.id);
            };
            i = i + 1;
        };
        
        result
    }
    
    /// Helper function to find process index in the vector
    fun find_process_index(processes: &vector<Process>, id: &String): u64 {
        let i = 0;
        let len = vector::length(processes);
        
        while (i < len) {
            let process = vector::borrow(processes, i);
            if (&process.id == id) {
                return i
            };
            i = i + 1;
        };
        
        len // Return length if not found (will be handled as not found)
    }
} 