module process_registry {
    use std::string::{Self, String};
    use std::vector;
    use aptos_framework::account;
    use aptos_std::table::{Self, Table};
    use aptos_framework::event::{Self, EventHandle};
    
    /// Errors
    const E_PROCESS_ALREADY_EXISTS: u64 = 1;
    const E_PROCESS_NOT_FOUND: u64 = 2;
    const E_NOT_AUTHORIZED: u64 = 3;
    
    /// ProcessRegistry stores process metadata
    struct ProcessRegistry has key {
        /// Map of process ID to process metadata
        processes: Table<String, String>,
        /// List of all process IDs
        process_ids: vector<String>,
        /// Events
        process_registered_events: EventHandle<ProcessRegisteredEvent>,
        process_updated_events: EventHandle<ProcessUpdatedEvent>,
        process_removed_events: EventHandle<ProcessRemovedEvent>,
    }
    
    /// Event emitted when a process is registered
    struct ProcessRegisteredEvent has drop, store {
        process_id: String,
        metadata: String,
    }
    
    /// Event emitted when a process is updated
    struct ProcessUpdatedEvent has drop, store {
        process_id: String,
        metadata: String,
    }
    
    /// Event emitted when a process is removed
    struct ProcessRemovedEvent has drop, store {
        process_id: String,
    }
    
    /// Initialize the process registry
    public entry fun initialize(account: &signer) {
        let addr = account::get_address(account);
        
        // Check if registry already exists
        if (exists<ProcessRegistry>(addr)) {
            return
        };
        
        // Create and initialize the registry
        move_to(account, ProcessRegistry {
            processes: table::new(),
            process_ids: vector::empty<String>(),
            process_registered_events: account::new_event_handle<ProcessRegisteredEvent>(account),
            process_updated_events: account::new_event_handle<ProcessUpdatedEvent>(account),
            process_removed_events: account::new_event_handle<ProcessRemovedEvent>(account),
        });
    }
    
    /// Register a new process
    public entry fun register_process(
        account: &signer,
        process_id: String,
        metadata: String
    ) acquires ProcessRegistry {
        let addr = account::get_address(account);
        
        // Get the registry
        let registry = borrow_global_mut<ProcessRegistry>(addr);
        
        // Ensure process doesn't already exist
        assert!(!table::contains(&registry.processes, process_id), E_PROCESS_ALREADY_EXISTS);
        
        // Add process to the registry
        table::add(&mut registry.processes, process_id, metadata);
        vector::push_back(&mut registry.process_ids, process_id);
        
        // Emit event
        event::emit_event(
            &mut registry.process_registered_events,
            ProcessRegisteredEvent { 
                process_id, 
                metadata 
            }
        );
    }
    
    /// Update an existing process
    public entry fun update_process(
        account: &signer,
        process_id: String,
        metadata: String
    ) acquires ProcessRegistry {
        let addr = account::get_address(account);
        
        // Get the registry
        let registry = borrow_global_mut<ProcessRegistry>(addr);
        
        // Ensure process exists
        assert!(table::contains(&registry.processes, process_id), E_PROCESS_NOT_FOUND);
        
        // Update the process metadata
        *table::borrow_mut(&mut registry.processes, process_id) = metadata;
        
        // Emit event
        event::emit_event(
            &mut registry.process_updated_events,
            ProcessUpdatedEvent { 
                process_id, 
                metadata 
            }
        );
    }
    
    /// Remove a process
    public entry fun deregister_process(
        account: &signer,
        process_id: String
    ) acquires ProcessRegistry {
        let addr = account::get_address(account);
        
        // Get the registry
        let registry = borrow_global_mut<ProcessRegistry>(addr);
        
        // Ensure process exists
        assert!(table::contains(&registry.processes, process_id), E_PROCESS_NOT_FOUND);
        
        // Remove the process
        table::remove(&mut registry.processes, process_id);
        
        // Remove from process_ids list
        let (found, index) = vector::index_of(&registry.process_ids, &process_id);
        if (found) {
            vector::remove(&mut registry.process_ids, index);
        };
        
        // Emit event
        event::emit_event(
            &mut registry.process_removed_events,
            ProcessRemovedEvent { 
                process_id
            }
        );
    }
    
    /// Get a process by ID (view function)
    #[view]
    public fun get_process(addr: address, process_id: String): String acquires ProcessRegistry {
        let registry = borrow_global<ProcessRegistry>(addr);
        
        assert!(table::contains(&registry.processes, process_id), E_PROCESS_NOT_FOUND);
        
        *table::borrow(&registry.processes, process_id)
    }
    
    /// List all process IDs (view function)
    #[view]
    public fun list_processes(addr: address): vector<String> acquires ProcessRegistry {
        let registry = borrow_global<ProcessRegistry>(addr);
        registry.process_ids
    }
} 