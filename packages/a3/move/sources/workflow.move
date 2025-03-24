module a3::workflow {
    use std::string::{String};
    use std::signer;
    use std::error;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use a3::payment;

    /// Errors
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_WORKFLOW_NOT_FOUND: u64 = 2;
    const E_WORKFLOW_ALREADY_EXISTS: u64 = 3;
    const E_TASK_NOT_FOUND: u64 = 4;
    const E_TASK_ALREADY_EXISTS: u64 = 5;
    const E_INVALID_WORKFLOW_STATUS: u64 = 6;
    const E_INVALID_TASK_STATUS: u64 = 7;
    const E_NO_PAYMENT_FOUND: u64 = 8;
    
    /// Workflow status
    const WORKFLOW_STATUS_DRAFT: u8 = 0;
    const WORKFLOW_STATUS_ACTIVE: u8 = 1;
    const WORKFLOW_STATUS_PAUSED: u8 = 2;
    const WORKFLOW_STATUS_COMPLETED: u8 = 3;
    const WORKFLOW_STATUS_ARCHIVED: u8 = 4;
    
    /// Task status
    const TASK_STATUS_PENDING: u8 = 0;
    const TASK_STATUS_IN_PROGRESS: u8 = 1;
    const TASK_STATUS_COMPLETED: u8 = 2;
    const TASK_STATUS_APPROVED: u8 = 3;
    const TASK_STATUS_FAILED: u8 = 4;
    
    /// Task structure
    struct Task has key, store, drop {
        id: String,
        name: String,
        description: String,
        owner: address,
        assignee: address,
        requester: address, // The user who requested the task
        process_id: String, // Associated process ID
        status: u8,
        dependencies: vector<String>, // Task IDs this task depends on
        created_at: u64,
        updated_at: u64,
    }
    
    /// Workflow structure
    struct Workflow has key, store {
        id: String,
        name: String,
        description: String,
        owner: address,
        status: u8,
        tasks: vector<Task>,
        created_at: u64,
        updated_at: u64,
    }
    
    /// Store for workflows
    struct WorkflowStore has key {
        workflows: vector<Workflow>,
    }
    
    /// Events
    struct WorkflowCreatedEvent has drop, store {
        id: String,
        name: String,
        owner: address,
        timestamp: u64,
    }
    
    struct WorkflowUpdatedEvent has drop, store {
        id: String,
        name: String,
        owner: address,
        status: u8,
        timestamp: u64,
    }
    
    struct TaskAddedEvent has drop, store {
        workflow_id: String,
        task_id: String,
        name: String,
        assignee: address,
        requester: address,
        process_id: String,
        timestamp: u64,
    }
    
    struct TaskUpdatedEvent has drop, store {
        workflow_id: String,
        task_id: String,
        status: u8,
        timestamp: u64,
    }
    
    struct TaskApprovedEvent has drop, store {
        workflow_id: String,
        task_id: String,
        requester: address,
        assignee: address,
        process_id: String,
        timestamp: u64,
    }
    
    struct PaymentReleasedEvent has drop, store {
        workflow_id: String,
        task_id: String,
        process_id: String,
        requester: address,
        assignee: address,
        amount: u64,
        timestamp: u64,
    }
    
    /// Initialize module
    public entry fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);
        if (!exists<WorkflowStore>(account_addr)) {
            move_to(account, WorkflowStore {
                workflows: vector::empty<Workflow>(),
            });
        };
    }
    
    /// Create a new workflow
    public entry fun create_workflow(
        account: &signer,
        id: String,
        name: String,
        description: String
    ) {
        let owner = signer::address_of(account);
        
        // Check if workflow already exists
        assert!(!workflow_exists(id), error::already_exists(E_WORKFLOW_ALREADY_EXISTS));
        
        let current_time = timestamp::now_seconds();
        
        // Create new workflow
        let workflow = Workflow {
            id,
            name,
            description,
            owner,
            status: WORKFLOW_STATUS_DRAFT,
            tasks: vector::empty<Task>(),
            created_at: current_time,
            updated_at: current_time,
        };
        
        // Store workflow
        if (!exists<WorkflowStore>(@a3)) {
            move_to(account, WorkflowStore {
                workflows: vector::singleton(workflow),
            });
        } else {
            let store = borrow_global_mut<WorkflowStore>(@a3);
            vector::push_back(&mut store.workflows, workflow);
        };
        
        // Emit event
        event::emit(WorkflowCreatedEvent {
            id,
            name,
            owner,
            timestamp: current_time,
        });
    }
    
    /// Update workflow status
    public entry fun update_workflow_status(
        account: &signer,
        workflow_id: String,
        new_status: u8
    ) {
        let account_addr = signer::address_of(account);
        
        // Check workflow exists
        assert!(workflow_exists(workflow_id), error::not_found(E_WORKFLOW_NOT_FOUND));
        
        // Get workflow
        let store = borrow_global_mut<WorkflowStore>(@a3);
        let workflow_idx = find_workflow_index(&store.workflows, workflow_id);
        let workflow = vector::borrow_mut(&mut store.workflows, workflow_idx);
        
        // Check authorization
        assert!(workflow.owner == account_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Check valid status
        assert!(
            new_status == WORKFLOW_STATUS_DRAFT ||
            new_status == WORKFLOW_STATUS_ACTIVE ||
            new_status == WORKFLOW_STATUS_PAUSED ||
            new_status == WORKFLOW_STATUS_COMPLETED ||
            new_status == WORKFLOW_STATUS_ARCHIVED,
            error::invalid_argument(E_INVALID_WORKFLOW_STATUS)
        );
        
        // Update status
        workflow.status = new_status;
        workflow.updated_at = timestamp::now_seconds();
        
        // Emit event
        event::emit(WorkflowUpdatedEvent {
            id: workflow.id,
            name: workflow.name,
            owner: workflow.owner,
            status: new_status,
            timestamp: workflow.updated_at,
        });
    }
    
    /// Add task to workflow
    public entry fun add_task(
        account: &signer,
        workflow_id: String,
        task_id: String,
        task_name: String,
        task_description: String,
        assignee: address,
        requester: address,
        process_id: String,
        dependencies: vector<String>
    ) {
        let account_addr = signer::address_of(account);
        
        // Check workflow exists
        assert!(workflow_exists(workflow_id), error::not_found(E_WORKFLOW_NOT_FOUND));
        
        // Get workflow
        let store = borrow_global_mut<WorkflowStore>(@a3);
        let workflow_idx = find_workflow_index(&store.workflows, workflow_id);
        let workflow = vector::borrow_mut(&mut store.workflows, workflow_idx);
        
        // Check authorization
        assert!(workflow.owner == account_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Check if task already exists
        assert!(!task_exists_in_workflow(workflow, task_id), error::already_exists(E_TASK_ALREADY_EXISTS));
        
        // Create task
        let current_time = timestamp::now_seconds();
        let task = Task {
            id: task_id,
            name: task_name,
            description: task_description,
            owner: account_addr,
            assignee,
            requester,
            process_id,
            status: TASK_STATUS_PENDING,
            dependencies,
            created_at: current_time,
            updated_at: current_time,
        };
        
        // Add task to workflow
        vector::push_back(&mut workflow.tasks, task);
        workflow.updated_at = current_time;
        
        // Emit event
        event::emit(TaskAddedEvent {
            workflow_id: workflow_id,
            task_id,
            name: task_name,
            assignee,
            requester,
            process_id,
            timestamp: current_time,
        });
    }
    
    /// Update task status
    public entry fun update_task_status(
        account: &signer,
        workflow_id: String,
        task_id: String,
        new_status: u8
    ) {
        let account_addr = signer::address_of(account);
        
        // Check workflow exists
        assert!(workflow_exists(workflow_id), error::not_found(E_WORKFLOW_NOT_FOUND));
        
        // Get workflow
        let store = borrow_global_mut<WorkflowStore>(@a3);
        let workflow_idx = find_workflow_index(&store.workflows, workflow_id);
        let workflow = vector::borrow_mut(&mut store.workflows, workflow_idx);
        
        // Find task
        let task_idx = find_task_index_in_workflow(workflow, task_id);
        assert!(task_idx < vector::length(&workflow.tasks), error::not_found(E_TASK_NOT_FOUND));
        
        let task = vector::borrow_mut(&mut workflow.tasks, task_idx);
        
        // Check authorization (owner or assignee)
        assert!(
            workflow.owner == account_addr || task.assignee == account_addr,
            error::permission_denied(E_NOT_AUTHORIZED)
        );
        
        // Only allow certain status transitions
        if (account_addr == task.assignee) {
            // Assignee can only mark as COMPLETED or FAILED
            assert!(
                new_status == TASK_STATUS_IN_PROGRESS || 
                new_status == TASK_STATUS_COMPLETED || 
                new_status == TASK_STATUS_FAILED,
                error::invalid_argument(E_INVALID_TASK_STATUS)
            );
        } else {
            // Owner can change to any status
            assert!(
                new_status == TASK_STATUS_PENDING ||
                new_status == TASK_STATUS_IN_PROGRESS ||
                new_status == TASK_STATUS_COMPLETED ||
                new_status == TASK_STATUS_APPROVED ||
                new_status == TASK_STATUS_FAILED,
                error::invalid_argument(E_INVALID_TASK_STATUS)
            );
        };
        
        // Update status
        task.status = new_status;
        task.updated_at = timestamp::now_seconds();
        workflow.updated_at = task.updated_at;
        
        // Emit event
        event::emit(TaskUpdatedEvent {
            workflow_id: workflow_id,
            task_id: task_id,
            status: new_status,
            timestamp: task.updated_at,
        });
        
        // Check if all tasks are completed or approved
        let all_completed = true;
        let i = 0;
        let len = vector::length(&workflow.tasks);
        
        while (i < len) {
            let task = vector::borrow(&workflow.tasks, i);
            if (task.status != TASK_STATUS_COMPLETED && task.status != TASK_STATUS_APPROVED) {
                all_completed = false;
                break
            };
            i = i + 1;
        };
        
        // If all tasks completed, update workflow status
        if (all_completed && workflow.status == WORKFLOW_STATUS_ACTIVE) {
            workflow.status = WORKFLOW_STATUS_COMPLETED;
            
            // Emit workflow updated event
            event::emit(WorkflowUpdatedEvent {
                id: workflow.id,
                name: workflow.name,
                owner: workflow.owner,
                status: WORKFLOW_STATUS_COMPLETED,
                timestamp: workflow.updated_at,
            });
        };
    }
    
    /// Approve a completed task and release payment
    public entry fun approve_task_and_release_payment(
        account: &signer,
        workflow_id: String,
        task_id: String
    ) {
        let requester_addr = signer::address_of(account);
        
        // Check workflow exists
        assert!(workflow_exists(workflow_id), error::not_found(E_WORKFLOW_NOT_FOUND));
        
        // Get workflow
        let store = borrow_global_mut<WorkflowStore>(@a3);
        let workflow_idx = find_workflow_index(&store.workflows, workflow_id);
        let workflow = vector::borrow_mut(&mut store.workflows, workflow_idx);
        
        // Find task
        let task_idx = find_task_index_in_workflow(workflow, task_id);
        assert!(task_idx < vector::length(&workflow.tasks), error::not_found(E_TASK_NOT_FOUND));
        
        let task = vector::borrow_mut(&mut workflow.tasks, task_idx);
        
        // Check authorization (only requester can approve)
        assert!(task.requester == requester_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Check task is completed
        assert!(task.status == TASK_STATUS_COMPLETED, error::invalid_state(E_INVALID_TASK_STATUS));
        
        // Check if payment exists
        assert!(payment::payment_exists(task.process_id, task.id, requester_addr), error::not_found(E_NO_PAYMENT_FOUND));
        
        // Update task status to approved
        task.status = TASK_STATUS_APPROVED;
        task.updated_at = timestamp::now_seconds();
        workflow.updated_at = task.updated_at;
        
        // Release payment
        payment::release_payment(account, task.process_id, task.id);
        
        // Get payment details for the event
        let (_, _, _, _, amount, _, _, _, _) = payment::get_payment(task.process_id, task.id, requester_addr);
        
        // Emit task approved event
        event::emit(TaskApprovedEvent {
            workflow_id: workflow_id,
            task_id: task_id,
            requester: requester_addr,
            assignee: task.assignee,
            process_id: task.process_id,
            timestamp: task.updated_at,
        });
        
        // Emit payment released event
        event::emit(PaymentReleasedEvent {
            workflow_id: workflow_id,
            task_id: task_id,
            process_id: task.process_id,
            requester: requester_addr,
            assignee: task.assignee,
            amount: amount,
            timestamp: task.updated_at,
        });
    }
    
    /// Check if workflow exists
    public fun workflow_exists(workflow_id: String): bool {
        if (!exists<WorkflowStore>(@a3)) {
            return false
        };
        
        let store = borrow_global<WorkflowStore>(@a3);
        find_workflow_index(&store.workflows, workflow_id) < vector::length(&store.workflows)
    }
    
    /// Get workflow details
    public fun get_workflow(workflow_id: String): (
        String, String, String, address, u8, u64, u64
    ) {
        assert!(workflow_exists(workflow_id), error::not_found(E_WORKFLOW_NOT_FOUND));
        
        let store = borrow_global<WorkflowStore>(@a3);
        let workflow_idx = find_workflow_index(&store.workflows, workflow_id);
        let workflow = vector::borrow(&store.workflows, workflow_idx);
        
        (
            workflow.id,
            workflow.name,
            workflow.description,
            workflow.owner,
            workflow.status,
            workflow.created_at,
            workflow.updated_at
        )
    }
    
    /// Get workflow task count
    public fun get_workflow_task_count(workflow_id: String): u64 {
        assert!(workflow_exists(workflow_id), error::not_found(E_WORKFLOW_NOT_FOUND));
        
        let store = borrow_global<WorkflowStore>(@a3);
        let workflow_idx = find_workflow_index(&store.workflows, workflow_id);
        let workflow = vector::borrow(&store.workflows, workflow_idx);
        
        vector::length(&workflow.tasks)
    }
    
    /// Get task details by index
    public fun get_task_by_index(workflow_id: String, task_idx: u64): (
        String, String, String, address, address, address, String, u8, u64, u64
    ) {
        assert!(workflow_exists(workflow_id), error::not_found(E_WORKFLOW_NOT_FOUND));
        
        let store = borrow_global<WorkflowStore>(@a3);
        let workflow_idx = find_workflow_index(&store.workflows, workflow_id);
        let workflow = vector::borrow(&store.workflows, workflow_idx);
        
        assert!(task_idx < vector::length(&workflow.tasks), error::invalid_argument(E_TASK_NOT_FOUND));
        
        let task = vector::borrow(&workflow.tasks, task_idx);
        
        (
            task.id,
            task.name,
            task.description,
            task.owner,
            task.assignee,
            task.requester,
            task.process_id,
            task.status,
            task.created_at,
            task.updated_at
        )
    }
    
    /// Helper function to find workflow index
    fun find_workflow_index(workflows: &vector<Workflow>, workflow_id: String): u64 {
        let i = 0;
        let len = vector::length(workflows);
        
        while (i < len) {
            let workflow = vector::borrow(workflows, i);
            if (workflow.id == workflow_id) {
                return i
            };
            i = i + 1;
        };
        
        len // Return length if not found
    }
    
    /// Helper function to check if task exists in workflow
    fun task_exists_in_workflow(workflow: &Workflow, task_id: String): bool {
        find_task_index_in_workflow(workflow, task_id) < vector::length(&workflow.tasks)
    }
    
    /// Helper function to find task index in workflow
    fun find_task_index_in_workflow(workflow: &Workflow, task_id: String): u64 {
        let i = 0;
        let len = vector::length(&workflow.tasks);
        
        while (i < len) {
            let task = vector::borrow(&workflow.tasks, i);
            if (task.id == task_id) {
                return i
            };
            i = i + 1;
        };
        
        len // Return length if not found
    }
} 